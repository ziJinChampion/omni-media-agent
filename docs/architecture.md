# 架构设计 — omni-media-agent

## 1. 设计目标

| 目标 | 说明 |
| --- | --- |
| 多账号矩阵 | 一个平台托管 N 个垂类账号（动物科普、地理科普……），配置化扩展，不为新账号写新代码 |
| 全链路自动化 | 选题 → 素材 → 生成 → 审核 → 发布 → 数据回流，无人值守跑通；保留人工审核开关 |
| 平台可插拔 | 发布渠道（小红书/抖音/……）通过 adapter 抽象接入，新增平台 = 新增一个 adapter |
| 可观测可回放 | 每个内容工单（ContentJob）全生命周期状态持久化，失败可重试、过程可审计 |

## 2. 核心域模型

```
Account（账号）
├── id, platform(xhs/douyin), nickname, vertical(垂类: 动物/地理/…)
├── credential_ref（加密凭证引用）
├── config: 发布频率、时段、风格模板、是否需人工审核
└── status: active / paused / risk_controlled

ContentJob（内容工单，一次"选题→发布"的完整执行）
├── id, account_id, status（状态机，见 §4）
├── topic（选题 + 选题来源 + 去重指纹）
├── materials[]（文本资料、图片素材，含来源 URL 与溯源信息）
├── draft（标题/正文/标签/配图，多版本）
├── judge_score（准确性/吸引力/合规 三项评分 + 评语）
└── publish_result（平台、时间、回执、失败原因）

PublishRecord（发布记录 & 互动数据回流）
├── job_id, platform_post_id, published_at
└── metrics: likes / collects / comments / shares（定时抓取回流）
```

## 3. 内容生产流水线（Content Agent）

采用编排式多节点流水线（可用 LangGraph / 自研状态机实现），节点间通过持久化状态传递：

```
discover(选题) → dedup(去重) → research(资料检索)
      → collect_images(图片采集) → draft(初稿生成)
      → judge(LLM审核) ──不合格──→ revise(重写，≤2次)
      └──合格──→ human_review?(可选人工闸) → publish(发布)
```

各节点职责：

1. **discover 选题**：搜索源（搜索引擎/热点榜/RSS）拉取候选选题；策略 = 垂类关键词池 + 热点加权 + 历史选题去重。
2. **dedup 去重**：对选题做语义指纹（embedding 相似度），与近 N 天已发内容比对，阈值内直接换题。
3. **research 检索**：围绕选题抓取 3-5 个可信来源的文本资料，保留引用来源，供事实校验。
4. **collect_images 图片**：按关键词检索可用图片（优先免版权图库 / AI 生成兜底），记录来源与授权信息。
5. **draft 生成**：按账号风格模板生成（标题 ≤ 20 字带钩子、正文分段、3-6 个标签、配图顺序）。
6. **judge 审核**：LLM-as-Judge 三维度打分（事实准确性 vs 检索资料、平台风格契合度、合规风险词），任一维度低于阈值进入 revise，最多重写 2 次，仍不合格转人工。
7. **publish 发布**：调用对应平台 adapter；失败按指数退避重试，连续失败触发账号风控告警。

## 4. ContentJob 状态机

```
PENDING → RESEARCHING → DRAFTING → REVIEWING
   → REVISE（回 DRAFTING）
   → AWAITING_HUMAN（开启人工审核时）
   → PUBLISHING → PUBLISHED
   → FAILED（任意节点失败，带 retry_count，超限后 ALERT）
```

## 5. 账号矩阵管理（Account Hub）

- **凭证安全**：Cookie / token 使用对称加密（如 Fernet / KMS）落库，密钥通过环境变量注入，仓库零明文。
- **风控策略**：每账号独立的发布频率上限、时段窗口、随机抖动；发布后间隔随机化，降低行为特征。
- **账号健康**：发布失败率、登录态有效性、平台风控信号（验证/限流）聚合为健康分，低于阈值自动暂停并告警。

## 6. 发布适配层（Publisher Adapter）

```python
class PublisherAdapter(Protocol):
    def check_session(self, credential) -> bool: ...
    def publish(self, credential, draft: Draft) -> PublishResult: ...
    def fetch_metrics(self, credential, post_id) -> Metrics: ...
```

平台实现注意点：
- 小红书 / 抖音无公开内容发布 API，通常走 web 端自动化（Playwright）或第三方开放平台，需自行评估稳定性与合规性。
- adapter 必须实现幂等：同一 ContentJob 重复调用 publish 不产生重复帖子（以 job_id 做发布前检查）。

## 7. 调度（Scheduler）

- 每账号一条 cron 配置（如 `0 9 * * *` 每日 9 点），触发创建 ContentJob 入队。
- 队列 + worker 模式（如 Celery / Dramatiq / 轻量自研），worker 并发执行多个账号的流水线。
- 错峰：同一批次多账号任务加入随机延迟（5-30 分钟）。

## 8. 技术选型建议

| 模块 | 建议 |
| --- | --- |
| 语言/框架 | Python 3.12 + FastAPI（管理台 API） |
| Agent 编排 | LangGraph（Checkpoint 持久化天然契合状态机） |
| 任务队列 | PostgreSQL + 轻量队列（或 Dramatiq + Redis） |
| 存储 | PostgreSQL（业务数据） + S3 兼容对象存储（图片素材） |
| 搜索 | Tavily / SerpAPI / 自采搜索源 |
| 浏览器自动化 | Playwright（发布 adapter） |
| 前端 | Next.js 管理台（账号管理、审核队列、数据看板） |

## 9. 目录结构（规划）

```
omni-media-agent/
├── apps/
│   ├── api/            # FastAPI 管理台后端
│   ├── worker/         # 流水线 worker
│   └── web/            # 管理台前端
├── core/
│   ├── agents/         # 流水线节点（discover/research/draft/judge/…）
│   ├── publishers/     # 平台 adapter
│   ├── scheduler/      # cron 调度
│   └── models/         # 域模型 & DB schema
├── configs/
│   └── accounts.yaml   # 账号与垂类配置（凭证走 env）
└── docs/
```

## 10. 风险与合规

- 平台风控：自动化发布存在账号封禁风险，频率控制 + 人工抽检是底线。
- 内容合规：图片版权、事实准确性（Judge 节点 + 来源溯源）、广告法敏感词。
- 服务条款：本项目定位技术研究，实际商用前需评估各平台 ToS。
