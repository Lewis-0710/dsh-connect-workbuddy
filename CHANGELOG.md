# Changelog

## 1.4.0 (2026-09-11)

### Features

- **🆕 正式支持国际版 WorkBuddy AI（www.workbuddy.ai）**——国内版与国际版账号在本插件中获得完全对等的支持，**零配置、零开关，全自动**：

  - **怎么用**：在插件卡片的账号列表里选中国际版账号（凭据文件 `workbuddy-desktop-ai.info`，Gmail 等邮箱登录的那个）即等于切到国际版；选回手机号账号即回到国内版。区域判定完全跟随凭据文件自带的 `domain` 字段（国际版为 `www.workbuddy.ai`，国内版为 `www.codebuddy.cn` / `www.workbuddy.cn`），无需任何手动设置。
  - **国际账号可用的完整功能**（全部经真实国际账号端到端实测）：
    - **模型接入**：**20 个模型**进入 DSH 模型选择器，含国际版独有阵容——GPT-6-Astra、GPT-5.6-Sol / Terra / Luna、GPT-5.5 / 5.4 / 5.3-Codex、Gemini-3.5-Flash、免费的 `deepseek-v4.1-flash` / Hy3 / Hy4 preview 等；与国内版共有的 GLM-5.3 / 5.2、Kimi-K3 / K2.6 也正常列出；
    - **积分倍率**：20/20 模型全部带倍率展示（GPT-6-Astra x6.67、GPT-5.6-Sol x3.47、Auto x0.79、`deepseek-v4.1-flash` / Hy3 x0.00 免费等），与 WorkBuddy AI 官方客户端展示的是同一个 `credits` 字段（已在其 App bundle 中确认渲染数据源一致）；
    - **积分概览**：按套餐展示国际账号的剩余积分与到期时间（一次性 Bonus Pack 与月度 Free Plan Subscription 均正确区分），查询走国际网关 `https://www.workbuddy.ai`；
    - **每日签到**：签到状态与领取端点在国际网关实测可用；活动未开启时按钮自动禁用（409 守卫），开启后即可直接领取；
    - **对话路由**：chat 请求自动走国际网关，wire 协议与国内版同构（业务码 11128 等语义一致，`prepareChatBody` 的改写逻辑两侧通用）。
  - **核心修复：按渠道读取模型目录**。原先国际账号读 `/console/enterprises/personal/models`（国内路径，国际网关返回 HTTP 500）。改用两区域各自的正确来源后，国际账号首次拿到**完整 20 个模型**：
    - **国内**：`copilot.tencent.com/v2/enterprises/personal/models`（保持原样，29 个模型中取 `cli` agent 的 15 个）；
    - **国际**：`www.workbuddy.ai/v3/config` —— 关键在于**必须用桌面端 User-Agent**：配置服务按客户端渠道返回不同产品配置，`CLI/… CodeBuddy/…` 只给 35 个模型并**缺失 `deepseek-v4.1-flash`、`gpt-6-astra`**（尽管两者都能正常对话），而桌面渠道给出账号真实的 20 个 chat 模型。版本号无关（`WorkBuddy/5.5.2`、`WorkBuddy/1.0.0`、裸 `WorkBuddy` 结果一致），是 `WorkBuddy` 这个产品标识选择渠道。国内网关不需要这个切换：其桌面配置的 `cli` agent 为 0 个模型。
    - 国际账号此前**只剩 `hy3`、`hy4-preview`** 两个可用模型（`deepseek-v4.1-flash` 被静默丢弃、`gpt-6-astra` 不可见），现在 20 个全部就位，与 WorkBuddy AI 客户端的模型菜单一致。

### Fixes

- **目录与勾选按区域隔离（国内 / 国际各一套）**：此前 `lastCatalog` 与 `enabledModelIds` 是全局单槽。国内账号下勾选的模型（含 `deepseek-v4.1-flash`、`hy3-x`）在切到国际账号后，会与**国际目录**求交集——凡是国际目录里没有的 id 都被静默丢弃：国际账号实际只剩 `hy3`、`hy4-preview` 两个模型可用（`src/index.ts` 启动时 `deriveCatalog(国际目录, 国内勾选)`）。
  - 现改为 `regions.cn` / `regions.global` 两套独立槽位（目录、勾选、图片开关、上下文预算各一份），互不干扰；切换账号不再覆盖另一区域的配置。
  - 新增按区域区分的静态 fallback 目录：国际账号在首次拉取前不再被塞入国内模型清单（`FALLBACK_WORKBUDDY_MODELS_GLOBAL`，2026-09-11 从国际网关桌面渠道配置实测捕获 20 个模型及其倍率，含免费的 `deepseek-v4.1-flash`）。
  - 旧的扁平字段保留为**国内区域的迁移来源**（旧配置一律来自国内端点），国际区域绝不继承——这正是丢勾选的根源。
  - 卡片保存改为写入当前账号所属区域的槽位；usage 文档新增 `region` 字段供卡片定位。
- 三个探测脚本（`probe-models` / `probe-credits` / `probe-account-switch`）同步改用 `/v2/...` 路径：此前它们对国际账号同样会 500，导致诊断输出误导。
- 新增只读评估脚本 `scripts/probe-global-eval.mjs`：对比国际网关 `/v2/...`（500）与 `/v3/config`（200）两条取目录路径，并验证积分与签到端点——本轮的渠道发现即由它得出。

### Tests

- 新增 `fetchModels` 回归测试：stub 上游后断言 CN 凭据（`codebuddy.cn` / `workbuddy.cn`）拼出 `copilot.tencent.com/v2/enterprises/personal/models`、国际凭据（`workbuddy.ai`）拼出 `www.workbuddy.ai/v3/config`，并断言国际请求携带**桌面端 User-Agent**（`WorkBuddy/5.5.2`，CLI UA 会拿到缺模型的 35 个）、CN 请求**不得**携带桌面端 UA（国内桌面配置的 `cli` agent 为空）。把「按渠道取目录」钉死，防止日后退回会丢模型的取法。
- `regionOf` 测试补上 `www.workbuddy.cn`（国内版新 domain 形态，实测本机存在）。
- 新增区域隔离测试：`regionStateOf` 断言旧扁平字段只被读作国内状态、国际区域绝不继承、显式槽位优先；`fallbackModelsFor` 断言国内清单不得泄漏进国际（国内无 `gpt-*`/`gemini-*`，且 `default-model` 仅属国际）；web-status 断言文档携带的 `region` 与凭据域一致、且四个区域化访问器收到的都是该区域。
- **每日签到（领取）路由的守卫逻辑首次获得直接 handler 测试**（实测两区域端点行为后补齐）：
  - 活动未开启（国际账号实测形态，`active:false`）→ 409 且**绝不调用**上游领取；
  - 今日已签到 → 200 `alreadyCheckedIn` 且不调用上游领取（幂等保护）；
  - 活动开启且未签到 → 恰好领取一次、领取后重读状态并返回刷新后的连签天数；
  - 非回环 Origin → 403、非 POST → 405，两道安全守卫均在触碰上游前拒绝。
  - 实测依据（全部经插件真实代码路径、零状态变更验证）：CN 网关领取端点对已签到账号返回业务拒绝「今天已签到，请明天再来」；国际网关同路径存在，对未开启活动返回「签到活动未开启或已过期」（均为 HTTP 400 业务码而非 404，证明端点存在、鉴权与协议一致）。国际版 App bundle 中确认签到端点与插件同路径，官方 App 对签到走无前缀形态、`get-user-resource` 才需 `/v2` 前缀——插件统一 `/v2` 形态在两侧网关均实测可用。

## 1.3.0 (2026-09-10)

### Breaking Changes

- **跟进上游 DSH 内核 0.1.2-rc.1 → 0.1.5-rc.1**：本机 DSH Desktop 2.0.9 捆绑的内核已跃迁到 `0.1.5-rc.1`（npm `latest`），而插件此前按 `0.1.2-rc.1` 编译。依赖链与代码已对齐新内核线：

  - **`ResolvedPiAiProviderProfile.modelErrors` 变为必填**：`dsh-llm-pi-ai` 的 provider profile 在 0.1.5-rc.1 新增必填字段 `modelErrors`，`PiAiAdapter.modelOf` 会在每次请求时读取，并对其中列出的任何 model id 抛出 `INVALID_CONFIG`。本插件的目录来自上游实时读取，因此填**空 Map**——即「无已知失败模型」，绝不预先否定目录后续提供的模型。这是本次跃迁中本插件唯一的一处源码编译失败。
  - **`@deepseek-ai/dsh-client-runtime` 已停止发布**：该包停在 `0.1.1-rc.2`，在 0.1.5 线上既未发布也不在桌面捆绑集内（其槽位/会话服务迁至 `dsh-client-ui-renderer/client`）。此前客户端入口从它取 `ClientContext` 类型、并在 `dsh.client.inject` 中声明它。现改为：运行期注入以真实提供 `slots` 服务的 5 个包为准（移出 `dsh-client-runtime`），类型侧用具名 `WorkBuddyClientContext`（cordis `Context` + `slots`/`locale`/`settingsScope` 三个座位），使客户端入口在两条主机线上都能编译。
  - `@earendil-works/pi-ai`：`0.85.0` → `0.85.1`。

### Fixes

- **升级后 provider 注册不再静默失效**：`modelErrors` 缺失在 0.1.5-rc.1 上是**编译期**硬失败（本次已由 `pnpm run check` 捕获并修复）；回归测试进一步把「运行时该 map 必须为空」钉死，避免日后有人在其中塞入模型 id 而悄悄禁用整条路由。
- **客户端 half 不再依赖已消失的包**：`dsh-client-runtime` 在 0.1.5 主机上无法解析，客户端插件此前把它列为注入目标；现已移除，构建产物 `lib/client.js` 对它零引用。

### Dependencies

- 全部 `@deepseek-ai/dsh-*`：`0.1.2-rc.1` → `0.1.5-rc.2`（`0.1.5-rc.1` 为 npm `latest`，`rc.2` 已在 `next` 通道；本仓库按线跟进并锁在 lockfile）
- `@deepseek-ai/dsh-client-runtime`：保留 `0.1.1-rc.2`，**仅作旧主机线的类型来源**，不参与 0.1.5 运行时
- 新增 `@deepseek-ai/dsh-client-ui-renderer`：0.1.5 线上 `slots` 服务的真实提供方
- 依赖声明统一改为**范围**而非写死补丁版本（含 `pnpm-workspace.yaml` 的 `overrides`），升级时只需改一处版本串

### Docs

- 记录本轮内核跃迁的对照依据与影响判定：本插件**不受** F1（会话持久化改为句柄化接缝）与 F3（`PERSONA_SECTION` 改名）影响——全仓无会话日志直读、无 persona 段 key 注入；受影响面集中在 F4（导出面变化）与 A4（声明依赖须落在捆绑子集内）。

## 1.2.0 (2026-09-09)

### Features

- **模型选择器显示积分倍率**：DSH 模型选择器中的 WorkBuddy 模型现在按 WorkBuddy 自身选择器的拼写显示积分倍率（如 `GLM-5.3 · x0.79`；未解析到倍率则保持原名称，免费模型显示 `x0.00`）。仅改 DSH 侧显示名（`toPiModel` 与模型 discovery 的 `name`）：模型 `id`、`lastCatalog` 存档与插件卡片显示不变——DSH 的选择状态、会话事件（`model/selection` / `request/header`）、agent 默认模型设置与请求路由全部以 `provider + model id` 为连接键，倍率后缀不参与任何映射。

### Fixes

- **修复模型保存始终失败（`client api: settings/mutate rejected "ops"`）**：卡片保存 `lastCatalog` 时曾用 `nativeContextWindow: undefined, multimodal: undefined` 显式清字段——显式 `undefined` 值会穿过 `structuredClone` 并被设置写入路径的严格 JSON codec 拒绝，导致**整次保存静默失败**（错误是 unhandled rejection，UI 无任何提示；用户侧表现为「保存按钮按不下去」）。姊妹项目 dsh-connect-trae 的 payload 不含 undefined 字段，故不受影响。现在改用 `toPersistedWorkBuddyModel` 按 KEY 剥离卡片专用字段（附回归测试：持久化形状不得含 undefined 值属性、JSON 往返无损）。
- **保存失败可见化**：保存抛错此前是静默的 unhandled rejection（UI 零提示，正是它掩盖了上一条 bug）。现在保存失败时在按钮旁显示具体原因，草稿保持 dirty 可直接重试；成功路径与 dsh-connect-trae 卡片完全一致（保存中… → 自然结束 → 恢复「保存」并禁用），无额外装饰。

## 1.1.3 (2026-09-04)

### Breaking Changes

- **跟进上游 DSH 0.1.2-rc.1 / Cordis 4.0.2**：本插件依赖链全部更新至 `0.1.2-rc.1`（`@deepseek-ai/dsh-*`）与 `4.0.2`（`@deepseek-ai/cordis`）。以下 API 变更需要同步适配：

  - `installSettingsSection(ctx, ns, schema, entry, hooks)` 移除：改为 `ctx.settings.installSection(ctx, ns, schema, entry, hooks)`（实为 `SettingsProvider.installSection` 实例方法）。
  - `settingsNamespace('workbuddy')` 移除：改为 `'workbuddy' as SettingsNamespace`（dsh-settings 导出的 branded type）。
  - `registerModelDiscovery` 回调签名的 `signal` 字段从 `request.signal` 移至回调第二参数 `async (request, signal) =>`。
  - `SettingsNamespace` branded type 语义收紧：`WORKBUDDY_SETTINGS_NS` 需显式 `as SettingsNamespace` 断言。
  - Cordis 4.0.2 要求所有服务访问显式 inject：`inject` 声明从 `['llm']` 扩为 `['llm', 'settings']`。
  - `onChange` 回调在 `installSection` 注册时同步触发：涉及的前置变量（如 `invalidateCatalog`）需提前声明。

### Dependencies

- `@deepseek-ai/cordis`：`4.0.1` → `4.0.2`
- 所有 `@deepseek-ai/dsh-*` 包：`0.1.1-rc.1` → `0.1.2-rc.1`
- `@deepseek-ai/dsh-client-runtime`：`0.1.1-rc.2`（不变，0.1.2-rc.1 未发布）
- `@deepseek-ai/schemastery`：`3.18.1-rc.1` → `3.18.2`
- `@earendil-works/pi-ai`：`0.82.1` → `0.85.0`
- `@deepseek-ai/dsh-client-ui-settings`：补充显式 devDependency（已作为 0.1.2-rc.1 依赖）

### Infrastructure

- `pnpm.overrides` 从 `package.json` 迁移至 `pnpm-workspace.yaml`（pnpm 11 要求）。

## 1.1.2 (2026-08-31)

### Fixes

- **兼容当前 DSH 宿主（dsh-plugin-desktop@2.0.4，@deepseek-ai/* = 0.1.2-alpha.1）**：peerDependencies 中 8 个 `dsh-*` 包的预发布分支范围扩展为 `>=0.1.0-rc.1 <0.2.0 || >=0.1.1-rc.1 <0.2.0 || >=0.1.2-alpha.0 <0.1.3`，覆盖 0.1.0-rc / 0.1.1-rc / 0.1.2-alpha 全部已发布分支；`@earendil-works/pi-ai` 由精确 `0.82.1` 放宽为 `>=0.82.1 <0.85.0`（兼容宿主 0.84.3）。修复用户环境版本不匹配导致的 ERESOLVE / 静默排除。

## 1.1.1 (2026-08-31)

### Docs

- `RELEASING.md` 明确发布 2FA 约定：本项目使用**浏览器授权**，不用 `npm publish --otp=<码>` 命令行方式；补充验证 URL 404 时重跑生成新链接。

## 1.1.0 (2026-08-31)

### Features

- **切换账号出错提示**：切换账号后出现错误（如所选账号凭据失效返回 401）时，插件卡片账号信息区（令牌行下方）显示一行小字「出现错误，重新登录 WorkBuddy APP 即可」，提示用户通过重新登录恢复。

### Docs

- 市场收录对齐当前约定：正式提交 PR [#3812](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/3812) 仅保留 `data/plugins/dingminhua__dsh-connect-workbuddy.yml` 与生成的 README；**移除**对注册表 `data/screenshots.json` 的改动（该文件是旧约定回退，新约定为插件自己仓库根目录声明 `screenshots.json`）。
- README 与 README.en.md 市场章节补充「收录目录规范」（contributing.md 要点：单文件命名、url 一致、category、描述引号规则、`dsh.bundle` manifest、topic、CI 门槛、README 由脚本生成、每 PR ≤ 3 条）。
- 新增 `awesome-dsh-plugin-submission/README.md`：市场收录目录的操作说明与当前状态；删除已废弃的 `screenshots-entry.json` 草稿（对应旧约定往注册表加键的做法）。

## 1.0.1 (2026-08-30)

### Fixes

- 账号选择改为严格绑定用户显式选择：删除启动时按积分自动挑选账号的逻辑，未选号时跟随 App 当前登录（live 文件）；账号失效时不再静默切换到其他账号，而是报「未登录」让用户重新选择，避免账单落到用户未选择的账号上。

### Docs

- `docs/DESIGN.md` 对齐当前进度：图片输入改为手动勾选说明；补充 `reasoning.effort`（固定档位）形态与推理强度两态已知问题；积分展示补充月度周期套餐与每日签到；scripts 探针数量更新。
- README 与 README.en.md 功能特性更新：图片输入改为按模型手动勾选。
- 新增 `docs/reasoning-investigation.md`：记录推理强度调查结论（上游两态数据、DSH 链路、实测档位、待决策修复方向）。仅记录，未改代码。

## 1.0.0 (2026-08-30)

### Features

- **WorkBuddy 模型接入**：将本机登录的 WorkBuddy 模型注册为 DSH 的 `workbuddy` provider，通过安全 loopback shim 提供模型调用，DSH 本地执行工具循环。
- **模型管理**：从上游刷新完整模型目录后可逐项勾选启用；刷新为草稿操作，需显式保存。上游同时给出积分倍率、上下文/输出上限与推理档位（实测 16 个 cli 模型全部带出这些字段，原实现仅保留 id/name/token 上限）。
- **图片输入手动开关**：图片支持由用户在模型列表手动勾选「图片」复选框决定（默认不勾选），不再依赖上游 `supportsImages`/`disabledMultimodal` 自动推断；勾选保存后该模型声明 image 输入，未勾选仅 text。
- **本机账号切换**：扫描 WorkBuddy auth 目录（活跃文件 + 时间戳备份），按 uin 去重为多个可选账号，默认跟随 App 当前登录。
- **凭据路径多候选**：macOS / Windows(Local+Roaming) / Linux(XDG) 逐一探测，支持环境变量与配置覆盖。
- **只读积分概览**：按套餐聚合展示剩余积分，区分「月度周期套餐」与「一次性礼包」；查询不消耗积分。
- **每日签到**：卡片下方提供一键签到按钮，查询状态与领取均走 `/plugins/dsh-connect-workbuddy/checkin`（POST），回环来源校验 + 领取前二次确认，不会重复领取。
- **只读路由 trio**：`/plugins/dsh-connect-workbuddy/{usage,models/refresh,accounts/refresh}`，回环来源校验 + token 脱敏，积分查询失败降级为 `creditsError`。
- **CLI 诊断**：`status` / `doctor` / `logout`（`--json` 支持），doctor 列出每个发现的账号及其文件来源。

### Fixes

- **凭据选择优先活跃文件**：实测所有备份文件都声称 2027 年到期，但只有 `workbuddy-desktop.info` 的 token 被上游接受。改为活跃文件优先，到期时间仅作备份间排序。
- **无头 profile 下不再崩溃**：`ctx.effect()` 的回调同步执行，无 `webServer` 服务时（TUI）会同步抛错。现改为先 `ctx.get('webServer')` 判空再注册。
- **刷新保留用户选择**：从 WorkBuddy 刷新目录后，已启用的模型、已勾选的图片与上下文预算均按模型 id 重新映射保留，不再丢失。
- 测试不再污染真实 `$DSH_HOME`：vitest 配置隔离 DSH_HOME，避免写心跳与凭据副本到开发者真实 profile。

### Docs

- README 与 README.en.md 顶部新增插件使用界面截图，并新增 `screenshots.json` 登记截图路径。
- 确立溯源与致谢规范：`THIRD_PARTY_NOTICES.md` 完整记录参考项目及其许可证；README 与 README.en.md 的致谢章节按「连接内核的参照 / 插件外观与结构的基准」两类如实标注来源。
- `dsh-codex-connect`（Apache-2.0）作为唯一非 MIT 参考项，其第 4 条声明义务在 `THIRD_PARTY_NOTICES.md` 中单独履行。
- `docs/DESIGN.md` 第 5.3 节确立源文件头标注规范：每个借鉴自参考项目的文件必须写明「参考了谁 / 参考了什么 / 改动了什么」。
- `RELEASING.md` 将「核对溯源与致谢」列为发布前强制步骤。
- 新增 `awesome-dsh-plugin-submission/` 市场注册草稿（与 `dsh-connect-trae`、`dsh-subagent-default-model` 对齐），README 补充「市场收录与展示」章节。
