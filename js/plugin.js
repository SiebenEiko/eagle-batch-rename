(function () {
  const state = {
    activeModule: "rename",
    activeTab: "overall",
    rows: [],
    audit: {
      running: false,
      cancelRequested: false,
      results: [],
      scanned: 0,
      total: 0,
      source: ""
    },
    initialized: false,
    running: false,
    renderTimer: null,
    cancelRequested: false,
    closeAfterCancel: false,
    closeAllowed: false,
    closePromptOpen: false,
    language: "zh_CN",
    saveMode: "single"
  };

  const PREVIEW_RENDER_DEBOUNCE_MS = 80;
  const VISIBLE_ROW_LIMIT = 220;
  const LARGE_BATCH_THRESHOLD = 150;
  const STRESS_BATCH_THRESHOLD = 500;
  const ADAPTIVE_CONCURRENCY_THRESHOLD = 150;
  const MAX_SAVE_CONCURRENCY = 2;
  const FAST_SAVE_MS = 450;
  const SLOW_SAVE_MS = 1200;
  const FAST_SAVE_STREAK_FOR_CONCURRENCY = 8;
  const SAVE_RETRY_LIMIT = 2;
  const SAVE_RETRY_DELAY_MS = 180;
  const AUDIT_SCAN_CHUNK_SIZE = 500;
  const SYNOLOGY_WINDOWS_PATH_LIMIT = 247;
  const SYNOLOGY_NAME_LIMIT = 255;
  const SYNOLOGY_WARNING_PATH_LENGTH = 220;
  const SYNOLOGY_WARNING_NAME_LENGTH = 180;
  const AUDIT_MAX_IMPORT_BATCH = 200;
  const SUPPORTED_LANGUAGES = ["en", "zh_CN", "zh_TW"];

  const ids = [
    "moduleRenameButton",
    "moduleNasButton",
    "renameModule",
    "nasModule",
    "refreshSelected",
    "patternInput",
    "startInput",
    "stepInput",
    "digitsInput",
    "padInput",
    "letterInput",
    "letterCaseInput",
    "replaceFromInput",
    "replaceToInput",
    "prefixInput",
    "suffixInput",
    "insertEnabledInput",
    "insertPositionInput",
    "insertTextInput",
    "removeTextInput",
    "deleteRangeEnabledInput",
    "deleteStartInput",
    "deleteCountInput",
    "performanceNote",
    "removeSelected",
    "clearList",
    "fileTableBody",
    "selectionSummary",
    "moveTop",
    "moveUp",
    "moveDown",
    "moveBottom",
    "statusText",
    "progressText",
    "progressTrack",
    "progressBar",
    "startRename",
    "nasScanSelected",
    "nasScanAll",
    "nasStopScan",
    "nasImportBatch",
    "nasBatchSizeInput",
    "nasTopLimitInput",
    "nasStats",
    "nasTableBody"
  ];

  const elements = {};
  const illegalNamePattern = /[<>:"/\\|?*\u0000-\u001f]/;
  const reservedWindowsNamePattern = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  const controlsDisabledDuringRun = [
    "patternInput",
    "startInput",
    "stepInput",
    "digitsInput",
    "padInput",
    "letterInput",
    "letterCaseInput",
    "replaceFromInput",
    "replaceToInput",
    "prefixInput",
    "suffixInput",
    "insertEnabledInput",
    "insertPositionInput",
    "insertTextInput",
    "removeTextInput",
    "deleteRangeEnabledInput",
    "deleteStartInput",
    "deleteCountInput",
  ];

  const translations = {
    zh: {
      appTitle: "批量重命名",
      appDescription: "读取 Eagle 当前多选项目，按规则预览并批量修改名称。",
      moduleRename: "通用批量重命名",
      moduleNas: "Synology Drive 体检",
      nasTitle: "Synology Drive 命名体检",
      nasDescription: "扫描 Eagle 项目，找出可能导致 Synology Drive 同步失败的文件名和路径。",
      nasScanSelected: "扫描选中",
      nasScanAll: "扫描全库",
      nasStopScan: "停止扫描",
      nasImportBatch: "导入下一批",
      nasBatchSize: "每批导入",
      nasDisplayLimit: "显示上限",
      nasRulesNote: "默认按 Synology Drive / Windows 兼容性排序：完整路径超过 247 字符、文件名超过 255 字符、含非法字符或以 ~ 开头会优先显示。",
      nasStatsInitial: "尚未扫描。",
      nasStats: "已扫描 {scanned}/{total}，发现 {risks} 个风险项，已导入 {imported} 个。",
      nasThRisk: "风险",
      nasThName: "文件名",
      nasThNameLength: "文件名长度",
      nasThPathLength: "路径长度",
      nasThPath: "路径",
      nasEmpty: "先扫描选中项目或全库。",
      nasNoRisk: "未发现 Synology Drive 命名风险。",
      nasHiddenRowsNotice: "还有 {count} 个风险项未显示。它们保留在扫描结果中，可继续分批导入。",
      nasNoEagleApi: "未检测到 Eagle API，无法扫描资源库。",
      nasPreparingScan: "正在准备 Synology Drive 体检...",
      nasScanning: "正在体检 {processed}/{total}，已发现 {risks} 个风险项...",
      nasScanDone: "体检完成：扫描 {total} 个项目，发现 {risks} 个风险项。",
      nasScanCanceled: "体检已停止：扫描 {scanned}/{total}，发现 {risks} 个风险项。",
      nasScanFailed: "体检失败：{message}",
      nasImportNoResults: "没有可导入的风险项。",
      nasImportDone: "已导入 {count} 个风险项到批量重命名列表。",
      nasImportFailed: "导入失败：{message}",
      nasSwitchDenied: "重命名任务执行中，暂时不能切换模块。",
      nasRiskHigh: "高风险",
      nasRiskMedium: "注意",
      nasRiskPathTooLong: "完整路径 {value}/{limit}",
      nasRiskPathNearLimit: "路径接近上限 {value}/{limit}",
      nasRiskNameTooLong: "文件名 {value}/{limit}",
      nasRiskNameBytesTooLong: "文件名字节 {value}/{limit}",
      nasRiskNameLong: "文件名偏长 {value}",
      nasRiskNameBytesLong: "文件名字节偏长 {value}",
      nasRiskIllegalChars: "含非法字符",
      nasRiskStartsTilde: "以 ~ 开头",
      nasRiskTrailing: "结尾为空格或点",
      nasRiskReserved: "Windows 保留名",
      refreshSelected: "刷新选中",
      tabOverall: "整体",
      tabReplace: "替换",
      tabAddRemove: "添加/删除",
      overallRuleLabel: "命名规则",
      patternPlaceholder: "例如：作品_#，* 代表原名称，# 代表编号",
      hintOriginal: "使用 <code>*</code> 插入原名称。",
      hintNumber: "使用 <code>#</code> 插入数字或字母编号。",
      startAt: "开始于",
      increment: "增量",
      digits: "位数",
      padZero: "不足位数补 0",
      letterNumber: "字母编号",
      upper: "大写",
      lower: "小写",
      replaceFromLabel: "把文件名中的字符",
      replaceFromPlaceholder: "要查找的文本",
      replaceToLabel: "替换成",
      replaceToPlaceholder: "替换后的文本，可留空表示删除",
      prefixLabel: "文件名前添加",
      prefixPlaceholder: "前缀",
      suffixLabel: "文件名后添加",
      suffixPlaceholder: "后缀",
      insertEnabled: "扩展添加",
      fromIndex: "从第",
      insertPositionSuffix: "个字符开始添加",
      insertTextLabel: "添加字符串",
      removeTextLabel: "删除文件名中的",
      removeTextPlaceholder: "指定文本，留空则不处理",
      deleteRange: "扩展删除",
      deleteStartSuffix: "个字符开始",
      deleteCountLabel: "共删除",
      deleteCountSuffix: "个字符",
      performanceDefault: "大量文件建议分批处理。",
      performanceStress: "{total} 个项目，建议分批处理。",
      performanceVisible: "{total} 个项目，仅显示前 {visible} 个。",
      performanceLarge: "{total} 个项目，已启用自适应保存。",
      extManaged: "仅修改名称，不修改扩展名。",
      fileList: "文件列表",
      selectionUnread: "未读取文件",
      selectionSummary: "共 {total} 个项目，勾选可移除或调整顺序",
      selectionSummaryLimited: "共 {total} 个项目，当前仅渲染前 {visible} 个以保持性能",
      removeChecked: "移除勾选",
      clearAll: "全部移除",
      thOriginal: "原文件名",
      thPreview: "预览",
      thResult: "结果",
      readingSelected: "正在读取 Eagle 当前选中项目...",
      noRowsRefresh: "请在 Eagle 中多选项目后点击“刷新选中”。",
      hiddenRowsNotice: "还有 {count} 个项目未渲染在表格中，但会参与预览校验和重命名。",
      moveTop: "移到顶部",
      moveUp: "上移",
      moveDown: "下移",
      moveBottom: "移到底部",
      ready: "准备就绪",
      startRename: "开始重命名",
      runningRefreshDenied: "任务执行中，不能刷新选中列表。",
      readingEagle: "正在读取 Eagle 当前选中项目...",
      noEagleApi: "未检测到 Eagle API。请在 Eagle 插件窗口中运行。",
      selectedLoaded: "已读取 {total} 个选中项目。",
      noSelected: "当前没有选中项目。",
      loadFailed: "读取失败：{message}",
      listRemaining: "列表剩余 {total} 个项目。",
      listCleared: "已清空本次处理列表。",
      chooseMove: "请先勾选需要移动的项目。",
      duplicateError: "错误：本次列表内重名",
      duplicateResolved: "重名已自动处理",
      emptyName: "错误：名称不能为空",
      invalidChars: "错误：包含非法字符",
      trailingName: "错误：不能以空格或点结尾",
      tooLong: "错误：名称过长",
      unchanged: "未变化",
      readyRename: "准备重命名",
      fixErrors: "存在 {count} 个错误，修正后再执行。",
      progress: "正在重命名 {processed}/{total}，成功 {renamed}，跳过 {skipped}，失败 {failed}，模式 {mode}...",
      modeSingle: "单通道",
      modeParallel: "并发",
      skippedStatus: "已跳过",
      saveFailure: "Eagle 返回保存失败",
      renamedStatus: "已重命名",
      failedPrefix: "失败：{message}",
      terminated: "已终止：已处理 {processed}/{total}，重命名 {renamed} 个，跳过 {skipped} 个，失败 {failed} 个。",
      done: "完成：重命名 {renamed} 个，跳过 {skipped} 个，失败 {failed} 个。",
      terminating: "正在终止任务并关闭窗口...",
      notifyTitle: "批量重命名",
      closeMessage: "重命名任务尚未完成，是否终止任务并关闭窗口？",
      closeDetail: "已经保存成功的项目不会回滚；未处理的项目会保留原名称。关闭后当前列表和进度不会保留。",
      waitButton: "继续等待",
      cancelButton: "终止并关闭",
      taskRunningTitle: "任务未完成",
      unknownError: "未知错误"
    },
    en: {
      appTitle: "Batch Rename",
      appDescription: "Read the current Eagle selection, preview rules, and batch update item names.",
      moduleRename: "General Batch Rename",
      moduleNas: "Synology Drive Audit",
      nasTitle: "Synology Drive Naming Audit",
      nasDescription: "Scan Eagle items for names and paths that may fail Synology Drive sync.",
      nasScanSelected: "Scan Selection",
      nasScanAll: "Scan Library",
      nasStopScan: "Stop Scan",
      nasImportBatch: "Import Next Batch",
      nasBatchSize: "Batch size",
      nasDisplayLimit: "Display limit",
      nasRulesNote: "Sorted by Synology Drive / Windows compatibility: full paths over 247 characters, names over 255 characters, illegal characters, and names starting with ~ are prioritized.",
      nasStatsInitial: "Not scanned yet.",
      nasStats: "Scanned {scanned}/{total}; found {risks} risky items; imported {imported}.",
      nasThRisk: "Risk",
      nasThName: "Name",
      nasThNameLength: "Name length",
      nasThPathLength: "Path length",
      nasThPath: "Path",
      nasEmpty: "Scan the selection or library first.",
      nasNoRisk: "No Synology Drive naming risks found.",
      nasHiddenRowsNotice: "{count} more risky items are hidden. They remain in the scan result and can be imported in later batches.",
      nasNoEagleApi: "Eagle API was not detected, so the library cannot be scanned.",
      nasPreparingScan: "Preparing Synology Drive audit...",
      nasScanning: "Auditing {processed}/{total}; found {risks} risky items...",
      nasScanDone: "Audit complete: scanned {total} items; found {risks} risky items.",
      nasScanCanceled: "Audit stopped: scanned {scanned}/{total}; found {risks} risky items.",
      nasScanFailed: "Audit failed: {message}",
      nasImportNoResults: "No risky items are available to import.",
      nasImportDone: "Imported {count} risky items into the batch rename list.",
      nasImportFailed: "Import failed: {message}",
      nasSwitchDenied: "A rename task is running; modules cannot be switched yet.",
      nasRiskHigh: "High",
      nasRiskMedium: "Review",
      nasRiskPathTooLong: "full path {value}/{limit}",
      nasRiskPathNearLimit: "path near limit {value}/{limit}",
      nasRiskNameTooLong: "name {value}/{limit}",
      nasRiskNameBytesTooLong: "name bytes {value}/{limit}",
      nasRiskNameLong: "long name {value}",
      nasRiskNameBytesLong: "long name bytes {value}",
      nasRiskIllegalChars: "illegal characters",
      nasRiskStartsTilde: "starts with ~",
      nasRiskTrailing: "trailing space or dot",
      nasRiskReserved: "Windows reserved name",
      refreshSelected: "Refresh Selection",
      tabOverall: "Pattern",
      tabReplace: "Replace",
      tabAddRemove: "Add / Remove",
      overallRuleLabel: "Naming Pattern",
      patternPlaceholder: "Example: Work_#; * = original name, # = sequence",
      hintOriginal: "Use <code>*</code> to insert the original name.",
      hintNumber: "Use <code>#</code> to insert a number or letter sequence.",
      startAt: "Start",
      increment: "Step",
      digits: "Digits",
      padZero: "Pad with 0",
      letterNumber: "Letter sequence",
      upper: "Uppercase",
      lower: "Lowercase",
      replaceFromLabel: "Text to replace",
      replaceFromPlaceholder: "Text to find",
      replaceToLabel: "Replace with",
      replaceToPlaceholder: "Replacement text; leave empty to delete",
      prefixLabel: "Add before name",
      prefixPlaceholder: "Prefix",
      suffixLabel: "Add after name",
      suffixPlaceholder: "Suffix",
      insertEnabled: "Advanced insert",
      fromIndex: "From",
      insertPositionSuffix: "character",
      insertTextLabel: "Insert text",
      removeTextLabel: "Remove text from name",
      removeTextPlaceholder: "Specific text; leave empty to skip",
      deleteRange: "Advanced delete",
      deleteStartSuffix: "character",
      deleteCountLabel: "Delete",
      deleteCountSuffix: "characters",
      performanceDefault: "Use batches for large file sets.",
      performanceStress: "{total} items; batching is recommended.",
      performanceVisible: "{total} items; showing the first {visible}.",
      performanceLarge: "{total} items; adaptive saving is enabled.",
      extManaged: "Renames only; extensions stay unchanged.",
      fileList: "File List",
      selectionUnread: "No files loaded",
      selectionSummary: "{total} items. Check rows to remove or reorder.",
      selectionSummaryLimited: "{total} items. Rendering only the first {visible} rows for performance.",
      removeChecked: "Remove Checked",
      clearAll: "Remove All",
      thOriginal: "Original Name",
      thPreview: "Preview",
      thResult: "Result",
      readingSelected: "Reading current Eagle selection...",
      noRowsRefresh: "Select items in Eagle, then click “Refresh Selection”.",
      hiddenRowsNotice: "{count} more items are not rendered in the table, but they will still be validated and renamed.",
      moveTop: "Move to top",
      moveUp: "Move up",
      moveDown: "Move down",
      moveBottom: "Move to bottom",
      ready: "Ready",
      startRename: "Start Rename",
      runningRefreshDenied: "A task is running; the selection cannot be refreshed.",
      readingEagle: "Reading current Eagle selection...",
      noEagleApi: "Eagle API was not detected. Run this inside an Eagle plugin window.",
      selectedLoaded: "Loaded {total} selected items.",
      noSelected: "No items are currently selected.",
      loadFailed: "Load failed: {message}",
      listRemaining: "{total} items remain in the list.",
      listCleared: "The processing list has been cleared.",
      chooseMove: "Check the rows you want to move first.",
      duplicateError: "Error: duplicate name in this list",
      duplicateResolved: "Duplicate auto-resolved",
      emptyName: "Error: name cannot be empty",
      invalidChars: "Error: illegal characters",
      trailingName: "Error: cannot end with a space or dot",
      tooLong: "Error: name is too long",
      unchanged: "No change",
      readyRename: "Ready to rename",
      fixErrors: "{count} errors must be fixed before running.",
      progress: "Renaming {processed}/{total}; success {renamed}, skipped {skipped}, failed {failed}; mode {mode}...",
      modeSingle: "single",
      modeParallel: "parallel",
      skippedStatus: "Skipped",
      saveFailure: "Eagle returned save failure",
      renamedStatus: "Renamed",
      failedPrefix: "Failed: {message}",
      terminated: "Stopped: processed {processed}/{total}; renamed {renamed}, skipped {skipped}, failed {failed}.",
      done: "Done: renamed {renamed}, skipped {skipped}, failed {failed}.",
      terminating: "Stopping task and closing the window...",
      notifyTitle: "Batch Rename",
      closeMessage: "The rename task is still running. Stop it and close the window?",
      closeDetail: "Already saved items will not be rolled back. Unprocessed items keep their original names. The current list and progress will not be kept after closing.",
      waitButton: "Keep Waiting",
      cancelButton: "Stop and Close",
      taskRunningTitle: "Task Running",
      unknownError: "Unknown error"
    }
  };

  function whenReady() {
    if (document.readyState !== "loading") {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      document.addEventListener("DOMContentLoaded", resolve, { once: true });
    });
  }

  async function initialize() {
    await whenReady();
    if (!state.initialized) {
      cacheElements();
      initializeLanguage();
      bindEvents();
      bindCloseGuard();
      applyCurrentTheme();
      state.initialized = true;
    }
    await loadSelectedItems();
  }

  function cacheElements() {
    ids.forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    elements.moduleRenameButton.addEventListener("click", () => setActiveModule("rename"));
    elements.moduleNasButton.addEventListener("click", () => setActiveModule("nas"));

    document.querySelectorAll(".tab-button").forEach((button) => {
      button.addEventListener("click", () => {
        setActiveTab(button.dataset.tab);
      });
    });

    document.querySelectorAll(".rule-panel input, .rule-panel select").forEach((control) => {
      control.addEventListener("input", handleRuleChange);
      control.addEventListener("change", handleRuleChange);
    });

    elements.refreshSelected.addEventListener("click", loadSelectedItems);
    elements.removeSelected.addEventListener("click", removeCheckedRows);
    elements.clearList.addEventListener("click", clearRows);
    elements.moveTop.addEventListener("click", () => moveCheckedRows("top"));
    elements.moveUp.addEventListener("click", () => moveCheckedRows("up"));
    elements.moveDown.addEventListener("click", () => moveCheckedRows("down"));
    elements.moveBottom.addEventListener("click", () => moveCheckedRows("bottom"));
    elements.startRename.addEventListener("click", renameItems);
    elements.nasScanSelected.addEventListener("click", () => scanNasItems("selected"));
    elements.nasScanAll.addEventListener("click", () => scanNasItems("all"));
    elements.nasStopScan.addEventListener("click", stopNasScan);
    elements.nasImportBatch.addEventListener("click", importNasBatch);
    elements.nasTopLimitInput.addEventListener("change", renderAuditTable);

    elements.fileTableBody.addEventListener("change", (event) => {
      if (!event.target.matches("input[type='checkbox'][data-row-id]")) {
        return;
      }
      const row = findRow(event.target.dataset.rowId);
      if (row) {
        row.checked = event.target.checked;
        renderTable();
      }
    });

    elements.nasTableBody.addEventListener("change", (event) => {
      if (!event.target.matches("input[type='checkbox'][data-risk-id]")) {
        return;
      }
      const risk = findAuditRisk(event.target.dataset.riskId);
      if (risk) {
        risk.checked = event.target.checked;
      }
    });

    elements.letterInput.addEventListener("change", updateDependentControls);
    elements.insertEnabledInput.addEventListener("change", updateDependentControls);
    elements.deleteRangeEnabledInput.addEventListener("change", updateDependentControls);
    updateDependentControls();
  }

  function initializeLanguage() {
    const eagleApi = getEagleApi();
    const eagleLocale = eagleApi && eagleApi.app && eagleApi.app.locale;
    state.language = normalizeLanguageCode(eagleLocale);
    translatePage();
    setStatus(t("ready"));
  }

  function translatePage() {
    document.documentElement.lang = state.language.replace("_", "-");

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.innerHTML = t(element.dataset.i18n);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      element.placeholder = t(element.dataset.i18nPlaceholder);
    });

    document.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.title = t(element.dataset.i18nTitle);
    });

  }

  function t(key, params = {}) {
    const i18n = getI18next();
    if (i18n && typeof i18n.t === "function") {
      const localized = i18n.t(`ui.${key}`, params);
      if (localized && localized !== `ui.${key}`) {
        return localized;
      }
    }

    const dictionary = getFallbackDictionary(state.language);
    const template = dictionary[key] || translations.zh[key] || key;
    return template.replace(/\{(\w+)\}/g, (match, name) => {
      return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match;
    });
  }

  function normalizeLanguageCode(locale) {
    const value = String(locale || "").replace("-", "_");
    if (SUPPORTED_LANGUAGES.includes(value)) {
      return value;
    }

    const lowerValue = value.toLowerCase();
    if (lowerValue.startsWith("zh_tw") || lowerValue.startsWith("zh_hk") || lowerValue.startsWith("zh_mo")) {
      return "zh_TW";
    }
    if (lowerValue.startsWith("zh")) {
      return "zh_CN";
    }
    if (lowerValue.startsWith("en")) {
      return "en";
    }
    return "en";
  }

  function getI18next() {
    if (window.i18next) {
      return window.i18next;
    }

    try {
      return window.parent && window.parent.i18next ? window.parent.i18next : null;
    } catch (error) {
      return null;
    }
  }

  function getFallbackDictionary(language) {
    if (language === "en") {
      return translations.en;
    }
    return translations.zh;
  }

  function getEagleApi() {
    return window.eagle || globalThis.eagle || null;
  }

  function bindCloseGuard() {
    window.onbeforeunload = (event) => {
      if (!state.running || state.closeAllowed) {
        return undefined;
      }

      const shouldTerminate = confirmCancelRunningTaskSync();
      if (shouldTerminate) {
        allowImmediateCloseAfterCancel();
        return undefined;
      }

      event.preventDefault();
      event.returnValue = false;
      return false;
    };

    const eagleApi = getEagleApi();
    if (eagleApi && eagleApi.onThemeChanged) {
      eagleApi.onThemeChanged((theme) => {
        applyTheme(theme);
      });
    }
  }

  function setActiveModule(module) {
    if (state.running && module !== "rename") {
      setStatus(t("nasSwitchDenied"));
      return;
    }

    state.activeModule = module;
    elements.moduleRenameButton.classList.toggle("active", module === "rename");
    elements.moduleNasButton.classList.toggle("active", module === "nas");
    elements.renameModule.classList.toggle("active", module === "rename");
    elements.nasModule.classList.toggle("active", module === "nas");
    elements.startRename.style.display = module === "rename" ? "" : "none";

    if (module === "rename") {
      updateButtons();
      return;
    }

    updateAuditButtons();
  }

  function setActiveTab(tab) {
    state.activeTab = tab;

    document.querySelectorAll(".tab-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tab);
    });

    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `tab-${tab}`);
    });

    clearExecutionState();
    renderTable();
  }

  function handleRuleChange() {
    if (state.running) {
      return;
    }

    updateDependentControls();
    clearExecutionState();
    scheduleRender();
  }

  function scheduleRender(delay = PREVIEW_RENDER_DEBOUNCE_MS) {
    if (state.renderTimer) {
      clearTimeout(state.renderTimer);
    }

    state.renderTimer = setTimeout(() => {
      state.renderTimer = null;
      renderTable();
    }, delay);
  }

  function cancelScheduledRender() {
    if (!state.renderTimer) {
      return;
    }

    clearTimeout(state.renderTimer);
    state.renderTimer = null;
  }

  function updateDependentControls() {
    const useLetters = elements.letterInput.checked;
    elements.letterCaseInput.disabled = !useLetters;

    const insertEnabled = elements.insertEnabledInput.checked;
    elements.insertPositionInput.disabled = !insertEnabled;
    elements.insertTextInput.disabled = !insertEnabled;

    const deleteRangeEnabled = elements.deleteRangeEnabledInput.checked;
    elements.deleteStartInput.disabled = !deleteRangeEnabled;
    elements.deleteCountInput.disabled = !deleteRangeEnabled;
  }

  async function loadSelectedItems() {
    if (state.running) {
      setStatus(t("runningRefreshDenied"));
      return;
    }

    clearExecutionState();
    setStatus(t("readingEagle"));

    const eagleApi = getEagleApi();
    if (!eagleApi || !eagleApi.item) {
      state.rows = [];
      resetProgress(0);
      updatePerformanceNote(0);
      renderTable();
      setStatus(t("noEagleApi"));
      return;
    }

    try {
      const selectedItems = await eagleApi.item.getSelected();
      state.rows = selectedItems.map((item, index) => createRow(item, index));
      resetProgress(state.rows.length);
      updatePerformanceNote(state.rows.length);
      renderTable();
      setStatus(state.rows.length ? t("selectedLoaded", { total: state.rows.length }) : t("noSelected"));
    } catch (error) {
      state.rows = [];
      resetProgress(0);
      updatePerformanceNote(0);
      renderTable();
      setStatus(t("loadFailed", { message: getErrorMessage(error) }));
    }
  }

  function createRow(item, index) {
    return {
      id: item.id || `row-${index}-${Date.now()}`,
      item,
      originalName: String(item.name || ""),
      ext: String(item.ext || ""),
      checked: false,
      executionStatus: null,
      executionPreviewName: ""
    };
  }

  function removeCheckedRows() {
    state.rows = state.rows.filter((row) => !row.checked);
    resetProgress(state.rows.length);
    updatePerformanceNote(state.rows.length);
    renderTable();
    setStatus(t("listRemaining", { total: state.rows.length }));
  }

  function clearRows() {
    state.rows = [];
    resetProgress(0);
    updatePerformanceNote(0);
    renderTable();
    setStatus(t("listCleared"));
  }

  function moveCheckedRows(direction) {
    const checkedRows = state.rows.filter((row) => row.checked);
    if (!checkedRows.length) {
      setStatus(t("chooseMove"));
      return;
    }

    if (direction === "top") {
      state.rows = [
        ...checkedRows,
        ...state.rows.filter((row) => !row.checked)
      ];
    }

    if (direction === "bottom") {
      state.rows = [
        ...state.rows.filter((row) => !row.checked),
        ...checkedRows
      ];
    }

    if (direction === "up") {
      for (let index = 1; index < state.rows.length; index += 1) {
        if (state.rows[index].checked && !state.rows[index - 1].checked) {
          [state.rows[index - 1], state.rows[index]] = [state.rows[index], state.rows[index - 1]];
        }
      }
    }

    if (direction === "down") {
      for (let index = state.rows.length - 2; index >= 0; index -= 1) {
        if (state.rows[index].checked && !state.rows[index + 1].checked) {
          [state.rows[index], state.rows[index + 1]] = [state.rows[index + 1], state.rows[index]];
        }
      }
    }

    clearExecutionState();
    renderTable();
  }

  function clearExecutionState() {
    state.rows.forEach((row) => {
      row.executionStatus = null;
      row.executionPreviewName = "";
    });
  }

  function getSettings() {
    return {
      pattern: elements.patternInput.value || "*",
      start: parseInteger(elements.startInput.value, 1),
      step: parseInteger(elements.stepInput.value, 1),
      digits: Math.max(1, parseInteger(elements.digitsInput.value, 1)),
      pad: elements.padInput.checked,
      useLetters: elements.letterInput.checked,
      letterCase: elements.letterCaseInput.value,
      replaceFrom: elements.replaceFromInput.value,
      replaceTo: elements.replaceToInput.value,
      prefix: elements.prefixInput.value,
      suffix: elements.suffixInput.value,
      insertEnabled: elements.insertEnabledInput.checked,
      insertPosition: Math.max(1, parseInteger(elements.insertPositionInput.value, 1)),
      insertText: elements.insertTextInput.value,
      removeText: elements.removeTextInput.value,
      deleteRangeEnabled: elements.deleteRangeEnabledInput.checked,
      deleteStart: Math.max(1, parseInteger(elements.deleteStartInput.value, 1)),
      deleteCount: Math.max(1, parseInteger(elements.deleteCountInput.value, 1)),
      autoResolve: true
    };
  }

  function buildPreviews() {
    const settings = getSettings();
    const previews = state.rows.map((row, index) => {
      const rawName = buildName(row.originalName, index, settings);
      return {
        row,
        finalName: rawName,
        status: validateName(rawName, row.originalName),
        className: ""
      };
    });

    applyDuplicatePolicy(previews, settings.autoResolve);
    return previews;
  }

  function buildName(originalName, index, settings) {
    if (state.activeTab === "overall") {
      const sequenceValue = settings.start + (index * settings.step);
      const sequenceText = settings.useLetters
        ? formatLetters(sequenceValue, settings.letterCase)
        : formatNumber(sequenceValue, settings.digits, settings.pad);

      return settings.pattern
        .replace(/\*/g, originalName)
        .replace(/#+/g, (token) => {
          if (settings.useLetters) {
            return sequenceText;
          }
          return formatNumber(sequenceValue, Math.max(settings.digits, token.length), settings.pad);
        });
    }

    if (state.activeTab === "replace") {
      if (!settings.replaceFrom) {
        return originalName;
      }
      return originalName.split(settings.replaceFrom).join(settings.replaceTo);
    }

    let name = originalName;
    if (settings.removeText) {
      name = name.split(settings.removeText).join("");
    }
    if (settings.deleteRangeEnabled) {
      name = deleteByCharacterRange(name, settings.deleteStart, settings.deleteCount);
    }
    if (settings.insertEnabled && settings.insertText) {
      name = insertByCharacterPosition(name, settings.insertPosition, settings.insertText);
    }
    return `${settings.prefix}${name}${settings.suffix}`;
  }

  function validateName(name, originalName) {
    if (!name || !name.trim()) {
      return { type: "error", text: t("emptyName") };
    }

    if (illegalNamePattern.test(name)) {
      return { type: "error", text: t("invalidChars") };
    }

    if (/[. ]$/.test(name)) {
      return { type: "error", text: t("trailingName") };
    }

    if (Array.from(name).length > 255) {
      return { type: "error", text: t("tooLong") };
    }

    if (name === originalName) {
      return { type: "skip", text: t("unchanged") };
    }

    return { type: "ready", text: t("readyRename") };
  }

  function applyDuplicatePolicy(previews, autoResolve) {
    const validPreviews = previews.filter((preview) => preview.status.type !== "error");
    if (!validPreviews.length) {
      return;
    }

    if (!autoResolve) {
      const counts = new Map();
      validPreviews.forEach((preview) => {
        const key = preview.finalName.toLocaleLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      });

      validPreviews.forEach((preview) => {
        if (counts.get(preview.finalName.toLocaleLowerCase()) > 1) {
          preview.status = { type: "error", text: t("duplicateError") };
        }
      });
      return;
    }

    const used = new Set();
    validPreviews.forEach((preview) => {
      let candidate = preview.finalName;
      let key = candidate.toLocaleLowerCase();
      if (!used.has(key)) {
        used.add(key);
        return;
      }

      let suffix = 1;
      do {
        candidate = `${preview.finalName}_${suffix}`;
        key = candidate.toLocaleLowerCase();
        suffix += 1;
      } while (used.has(key));

      preview.finalName = candidate;
      preview.status = validateName(candidate, preview.row.originalName);
      if (preview.status.type !== "error" && candidate !== preview.row.originalName) {
        preview.status = { type: "warning", text: t("duplicateResolved") };
      }
      used.add(key);
    });
  }

  function renderTable() {
    cancelScheduledRender();
    const previews = buildPreviews();
    const visiblePreviews = getVisiblePreviews(previews);
    const hiddenCount = previews.length - visiblePreviews.length;
    elements.selectionSummary.textContent = state.rows.length
      ? hiddenCount
        ? t("selectionSummaryLimited", { total: state.rows.length, visible: visiblePreviews.length })
        : t("selectionSummary", { total: state.rows.length })
      : t("selectionUnread");

    if (!state.rows.length) {
      elements.fileTableBody.innerHTML = `<tr><td colspan="4" class="empty-cell">${escapeHtml(t("noRowsRefresh"))}</td></tr>`;
      updateButtons(previews);
      return;
    }

    elements.fileTableBody.innerHTML = [
      ...visiblePreviews.map((preview) => renderRow(preview)),
      hiddenCount ? renderHiddenRowsNotice(hiddenCount) : ""
    ].join("");
    updateButtons(previews);
  }

  function getVisiblePreviews(previews) {
    if (previews.length <= VISIBLE_ROW_LIMIT) {
      return previews;
    }

    return previews.slice(0, VISIBLE_ROW_LIMIT);
  }

  function renderHiddenRowsNotice(hiddenCount) {
    return `<tr><td colspan="4" class="empty-cell">${escapeHtml(t("hiddenRowsNotice", { count: hiddenCount }))}</td></tr>`;
  }

  function renderRow(preview) {
    const row = preview.row;
    const status = row.executionStatus || preview.status;
    const previewName = row.executionStatus ? row.executionPreviewName : preview.finalName;
    return `
      <tr>
        <td class="check-column">
          <input type="checkbox" data-row-id="${escapeHtml(row.id)}" ${row.checked ? "checked" : ""} ${state.running ? "disabled" : ""}>
        </td>
        <td title="${escapeHtml(formatDisplayName(row.originalName, row.ext))}">${escapeHtml(formatDisplayName(row.originalName, row.ext))}</td>
        <td title="${escapeHtml(formatDisplayName(previewName, row.ext))}">${escapeHtml(formatDisplayName(previewName, row.ext))}</td>
        <td class="status-${status.type}" title="${escapeHtml(status.text)}">${escapeHtml(status.text)}</td>
      </tr>
    `;
  }

  function updateButtons(previews = buildPreviews()) {
    const hasRows = state.rows.length > 0;
    const hasChecked = state.rows.some((row) => row.checked);
    const hasErrors = previews.some((preview) => preview.status.type === "error");

    setRunLockedControls(state.running);
    elements.removeSelected.disabled = !hasChecked || state.running;
    elements.clearList.disabled = !hasRows || state.running;
    elements.moveTop.disabled = !hasChecked || state.running;
    elements.moveUp.disabled = !hasChecked || state.running;
    elements.moveDown.disabled = !hasChecked || state.running;
    elements.moveBottom.disabled = !hasChecked || state.running;
    elements.refreshSelected.disabled = state.running;
    elements.startRename.disabled = !hasRows || hasErrors || state.running;
    updateAuditButtons();
  }

  function setRunLockedControls(disabled) {
    controlsDisabledDuringRun.forEach((id) => {
      if (elements[id]) {
        elements[id].disabled = disabled;
      }
    });

    if (!disabled) {
      updateDependentControls();
    }
  }

  async function scanNasItems(source) {
    if (state.audit.running) {
      return;
    }

    const eagleApi = getEagleApi();
    if (!eagleApi || !eagleApi.item) {
      setStatus(t("nasNoEagleApi"));
      return;
    }

    setActiveModule("nas");
    state.audit.running = true;
    state.audit.cancelRequested = false;
    state.audit.results = [];
    state.audit.scanned = 0;
    state.audit.total = 0;
    state.audit.source = source;
    renderAuditTable();
    updateAuditStats();
    updateAuditButtons();
    resetProgress(0);
    setStatus(t("nasPreparingScan"));

    try {
      const items = await getAuditSourceItems(source);
      const total = Array.isArray(items) ? items.length : 0;
      state.audit.total = total;
      resetProgress(total);

      const results = [];
      for (let index = 0; index < total; index += 1) {
        if (state.audit.cancelRequested) {
          break;
        }

        const risk = analyzeSynologyRisk(items[index]);
        if (risk) {
          results.push(risk);
        }

        state.audit.scanned = index + 1;
        if (state.audit.scanned % AUDIT_SCAN_CHUNK_SIZE === 0) {
          state.audit.results = results;
          updateAuditProgress(state.audit.scanned, total, results.length);
          updateAuditStats();
          await wait(0);
        }
      }

      results.sort(compareAuditRisks);
      state.audit.results = results;
      renderAuditTable();
      updateAuditStats();

      const canceled = state.audit.cancelRequested;
      const message = canceled
        ? t("nasScanCanceled", { scanned: state.audit.scanned, total, risks: results.length })
        : t("nasScanDone", { total, risks: results.length });
      setStatus(message);
      updateAuditProgress(state.audit.scanned, total, results.length, message);
    } catch (error) {
      setStatus(t("nasScanFailed", { message: getErrorMessage(error) }));
    } finally {
      state.audit.running = false;
      state.audit.cancelRequested = false;
      updateAuditButtons();
    }
  }

  async function getAuditSourceItems(source) {
    const eagleApi = getEagleApi();
    if (!eagleApi || !eagleApi.item) {
      throw new Error(t("noEagleApi"));
    }

    if (source === "selected") {
      return eagleApi.item.getSelected();
    }

    if (typeof eagleApi.item.get === "function") {
      try {
        const items = await eagleApi.item.get({
          fields: ["id", "name", "ext", "filePath"]
        });
        if (Array.isArray(items)) {
          return items;
        }
      } catch (error) {
        console.warn("Field-limited Eagle scan failed; falling back to getAll()", error);
      }
    }

    if (typeof eagleApi.item.getAll === "function") {
      return eagleApi.item.getAll();
    }

    throw new Error(t("noEagleApi"));
  }

  function stopNasScan() {
    if (!state.audit.running) {
      return;
    }
    state.audit.cancelRequested = true;
    updateAuditButtons();
  }

  async function importNasBatch() {
    if (state.running || state.audit.running) {
      return;
    }

    const importable = getImportableAuditResults();
    if (!importable.length) {
      setStatus(t("nasImportNoResults"));
      return;
    }

    const batch = importable.slice(0, getAuditBatchSize());
    try {
      const items = await getItemsByIds(batch.map((risk) => risk.id));
      const itemById = new Map(items.map((item) => [item.id, item]));
      const orderedItems = batch
        .map((risk) => itemById.get(risk.id))
        .filter(Boolean);

      if (!orderedItems.length) {
        setStatus(t("nasImportNoResults"));
        return;
      }

      state.rows = orderedItems.map((item, index) => createRow(item, index));
      batch.forEach((risk) => {
        risk.imported = true;
        risk.checked = false;
      });
      clearExecutionState();
      setActiveModule("rename");
      resetProgress(state.rows.length);
      renderTable();
      renderAuditTable();
      updateAuditStats();
      setStatus(t("nasImportDone", { count: state.rows.length }));
    } catch (error) {
      setStatus(t("nasImportFailed", { message: getErrorMessage(error) }));
    }
  }

  function getImportableAuditResults() {
    const checkedResults = state.audit.results.filter((risk) => risk.checked && !risk.imported);
    if (checkedResults.length) {
      return checkedResults;
    }
    return state.audit.results.filter((risk) => !risk.imported);
  }

  async function getItemsByIds(idsToLoad) {
    if (!idsToLoad.length) {
      return [];
    }

    const eagleApi = getEagleApi();
    if (!eagleApi || !eagleApi.item) {
      return [];
    }

    if (typeof eagleApi.item.getByIds === "function") {
      return eagleApi.item.getByIds(idsToLoad);
    }

    if (typeof eagleApi.item.get === "function") {
      const items = await eagleApi.item.get({ ids: idsToLoad });
      if (Array.isArray(items)) {
        return items;
      }
    }

    const items = [];
    for (const id of idsToLoad) {
      if (typeof eagleApi.item.getById === "function") {
        items.push(await eagleApi.item.getById(id));
      }
    }
    return items.filter(Boolean);
  }

  function analyzeSynologyRisk(item) {
    if (!item || !item.id) {
      return null;
    }

    const name = String(item.name || "");
    const ext = String(item.ext || "").replace(/^\./, "");
    const displayName = formatDisplayName(name, ext);
    const filePath = String(item.filePath || "");
    const nameChars = countCharacters(displayName);
    const pathChars = countCharacters(filePath);
    const nameBytes = getUtf8ByteLength(displayName);
    const reasons = [];
    let score = 0;

    if (pathChars > SYNOLOGY_WINDOWS_PATH_LIMIT) {
      score += addAuditReason(reasons, "nasRiskPathTooLong", { value: pathChars, limit: SYNOLOGY_WINDOWS_PATH_LIMIT }, 10000 + pathChars);
    } else if (pathChars > SYNOLOGY_WARNING_PATH_LENGTH) {
      score += addAuditReason(reasons, "nasRiskPathNearLimit", { value: pathChars, limit: SYNOLOGY_WINDOWS_PATH_LIMIT }, 5000 + pathChars);
    }

    if (nameChars > SYNOLOGY_NAME_LIMIT) {
      score += addAuditReason(reasons, "nasRiskNameTooLong", { value: nameChars, limit: SYNOLOGY_NAME_LIMIT }, 9000 + nameChars);
    } else if (nameChars > SYNOLOGY_WARNING_NAME_LENGTH) {
      score += addAuditReason(reasons, "nasRiskNameLong", { value: nameChars }, 3000 + nameChars);
    }

    if (nameBytes > SYNOLOGY_NAME_LIMIT) {
      score += addAuditReason(reasons, "nasRiskNameBytesTooLong", { value: nameBytes, limit: SYNOLOGY_NAME_LIMIT }, 8500 + nameBytes);
    } else if (nameBytes > SYNOLOGY_WARNING_NAME_LENGTH) {
      score += addAuditReason(reasons, "nasRiskNameBytesLong", { value: nameBytes }, 2800 + nameBytes);
    }

    if (illegalNamePattern.test(name)) {
      score += addAuditReason(reasons, "nasRiskIllegalChars", {}, 8000);
    }

    if (name.startsWith("~")) {
      score += addAuditReason(reasons, "nasRiskStartsTilde", {}, 7800);
    }

    if (/[. ]$/.test(name)) {
      score += addAuditReason(reasons, "nasRiskTrailing", {}, 7600);
    }

    if (reservedWindowsNamePattern.test(name.trim())) {
      score += addAuditReason(reasons, "nasRiskReserved", {}, 7400);
    }

    if (!reasons.length) {
      return null;
    }

    return {
      id: item.id,
      name,
      ext,
      displayName,
      filePath,
      nameChars,
      nameBytes,
      pathChars,
      reasons,
      score,
      severity: score >= 7000 ? "high" : "medium",
      checked: false,
      imported: false
    };
  }

  function addAuditReason(reasons, key, params, score) {
    reasons.push({ key, params });
    return score;
  }

  function compareAuditRisks(left, right) {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (right.pathChars !== left.pathChars) {
      return right.pathChars - left.pathChars;
    }
    return right.nameChars - left.nameChars;
  }

  function renderAuditTable() {
    if (!elements.nasTableBody) {
      return;
    }

    const results = state.audit.results;
    if (!results.length) {
      elements.nasTableBody.innerHTML = `<tr><td colspan="6" class="empty-cell">${escapeHtml(state.audit.scanned ? t("nasNoRisk") : t("nasEmpty"))}</td></tr>`;
      updateAuditButtons();
      return;
    }

    const displayLimit = getAuditDisplayLimit();
    const visibleResults = results.slice(0, displayLimit);
    const hiddenCount = results.length - visibleResults.length;
    elements.nasTableBody.innerHTML = [
      ...visibleResults.map((risk) => renderAuditRow(risk)),
      hiddenCount > 0 ? `<tr><td colspan="6" class="empty-cell">${escapeHtml(t("nasHiddenRowsNotice", { count: hiddenCount }))}</td></tr>` : ""
    ].join("");
    updateAuditButtons();
  }

  function renderAuditRow(risk) {
    const severityKey = risk.severity === "high" ? "nasRiskHigh" : "nasRiskMedium";
    return `
      <tr>
        <td class="check-column">
          <input type="checkbox" data-risk-id="${escapeHtml(risk.id)}" ${risk.checked ? "checked" : ""} ${risk.imported || state.audit.running ? "disabled" : ""}>
        </td>
        <td><span class="risk-badge risk-${risk.severity}">${escapeHtml(t(severityKey))}</span></td>
        <td title="${escapeHtml(risk.displayName)}">${escapeHtml(risk.displayName)}</td>
        <td title="${escapeHtml(formatAuditReasons(risk))}">${risk.nameChars} / ${risk.nameBytes}B</td>
        <td>${risk.pathChars || "-"}</td>
        <td title="${escapeHtml(risk.filePath)}">${escapeHtml(risk.filePath || "-")}</td>
      </tr>
    `;
  }

  function formatAuditReasons(risk) {
    return risk.reasons.map((reason) => t(reason.key, reason.params)).join("；");
  }

  function updateAuditStats() {
    if (!elements.nasStats) {
      return;
    }

    if (!state.audit.scanned && !state.audit.total && !state.audit.results.length) {
      elements.nasStats.textContent = t("nasStatsInitial");
      return;
    }

    elements.nasStats.textContent = t("nasStats", {
      scanned: state.audit.scanned,
      total: state.audit.total,
      risks: state.audit.results.length,
      imported: countImportedAuditResults()
    });
  }

  function updateAuditProgress(processed, total, risks, message) {
    const percent = total > 0 ? Math.min(100, (processed / total) * 100) : 0;
    elements.progressText.textContent = `${processed} / ${total}`;
    elements.progressBar.style.width = `${percent}%`;
    setStatus(message || t("nasScanning", { processed, total, risks }));
  }

  function updateAuditButtons() {
    if (!elements.nasScanSelected) {
      return;
    }

    const busy = state.audit.running || state.running;
    const hasImportable = state.audit.results.some((risk) => !risk.imported);
    elements.nasScanSelected.disabled = busy;
    elements.nasScanAll.disabled = busy;
    elements.nasStopScan.disabled = !state.audit.running;
    elements.nasImportBatch.disabled = busy || !hasImportable;
  }

  function getAuditDisplayLimit() {
    return Math.max(50, parseInteger(elements.nasTopLimitInput.value, 500));
  }

  function getAuditBatchSize() {
    return Math.min(AUDIT_MAX_IMPORT_BATCH, Math.max(10, parseInteger(elements.nasBatchSizeInput.value, 100)));
  }

  function countImportedAuditResults() {
    return state.audit.results.filter((risk) => risk.imported).length;
  }

  function countCharacters(value) {
    return Array.from(String(value || "")).length;
  }

  function getUtf8ByteLength(value) {
    if (window.TextEncoder) {
      return new TextEncoder().encode(String(value || "")).length;
    }
    return unescape(encodeURIComponent(String(value || ""))).length;
  }

  function findAuditRisk(riskId) {
    return state.audit.results.find((risk) => risk.id === riskId);
  }

  async function renameItems() {
    if (state.running) {
      return;
    }

    cancelScheduledRender();
    state.cancelRequested = false;
    state.closeAfterCancel = false;
    state.closeAllowed = false;
    setSaveMode("single");
    const previews = buildPreviews();
    const errors = previews.filter((preview) => preview.status.type === "error");
    if (errors.length) {
      renderTable();
      setStatus(t("fixErrors", { count: errors.length }));
      return;
    }

    state.running = true;
    renderTable();
    updateButtons(previews);
    updateProgress(0, previews.length, 0, 0, 0);

    const run = {
      previews,
      total: previews.length,
      nextIndex: 0,
      processed: 0,
      renamed: 0,
      skipped: 0,
      failed: 0,
      scheduler: createSaveScheduler(previews.length)
    };

    try {
      await runAdaptiveRename(run);
    } finally {
      const canceled = state.cancelRequested;
      state.running = false;
      state.cancelRequested = false;
      if (state.closeAllowed) {
        return;
      }
      renderTable();
      updateProgress(run.processed, run.total, run.renamed, run.skipped, run.failed);
      const message = canceled
        ? t("terminated", { processed: run.processed, total: run.total, renamed: run.renamed, skipped: run.skipped, failed: run.failed })
        : t("done", { renamed: run.renamed, skipped: run.skipped, failed: run.failed });
      setStatus(message);
      await notify(message);

      if (state.closeAfterCancel) {
        state.closeAllowed = true;
        window.close();
      }
    }
  }

  async function runAdaptiveRename(run) {
    return new Promise((resolve) => {
      const launch = () => {
        if (state.cancelRequested) {
          if (run.scheduler.active === 0) {
            resolve();
          }
          return;
        }

        while (run.scheduler.active < run.scheduler.concurrency && run.nextIndex < run.previews.length) {
          const preview = run.previews[run.nextIndex];
          run.nextIndex += 1;
          run.scheduler.active += 1;

          processRenamePreview(preview, run)
            .catch((error) => {
              console.warn("Rename worker failed", error);
            })
            .finally(() => {
              run.scheduler.active -= 1;
              if (run.nextIndex >= run.previews.length && run.scheduler.active === 0) {
                resolve();
                return;
              }
              launch();
            });
        }

        if (run.nextIndex >= run.previews.length && run.scheduler.active === 0) {
          resolve();
        }
      };

      launch();
    });
  }

  async function processRenamePreview(preview, run) {
    const row = preview.row;

    if (preview.finalName === row.originalName) {
      row.executionStatus = { type: "skip", text: t("skippedStatus") };
      row.executionPreviewName = preview.finalName;
      run.skipped += 1;
      markProcessed(run);
      return;
    }

    try {
      const saveStartedAt = getTimestamp();
      row.item.name = preview.finalName;
      await saveItemWithRetry(row.item);
      recordSaveMetric(run, getTimestamp() - saveStartedAt, true);
      row.originalName = preview.finalName;
      row.executionPreviewName = preview.finalName;
      row.executionStatus = { type: "success", text: t("renamedStatus") };
      run.renamed += 1;
    } catch (error) {
      recordSaveMetric(run, 0, false);
      row.executionPreviewName = preview.finalName;
      row.executionStatus = { type: "error", text: t("failedPrefix", { message: getErrorMessage(error) }) };
      run.failed += 1;
    }

    markProcessed(run);
  }

  function markProcessed(run) {
    run.processed += 1;
    updateProgress(run.processed, run.total, run.renamed, run.skipped, run.failed);
  }

  function createSaveScheduler(total) {
    return {
      active: 0,
      concurrency: 1,
      maxConcurrency: total >= ADAPTIVE_CONCURRENCY_THRESHOLD ? MAX_SAVE_CONCURRENCY : 1,
      fastStreak: 0
    };
  }

  function recordSaveMetric(run, duration, success) {
    const scheduler = run.scheduler;
    if (!scheduler || scheduler.maxConcurrency <= 1) {
      return;
    }

    if (!success || duration >= SLOW_SAVE_MS) {
      scheduler.concurrency = 1;
      scheduler.fastStreak = 0;
      setSaveMode("single");
      return;
    }

    if (duration <= FAST_SAVE_MS) {
      scheduler.fastStreak += 1;
      if (scheduler.fastStreak >= FAST_SAVE_STREAK_FOR_CONCURRENCY) {
        scheduler.concurrency = scheduler.maxConcurrency;
        setSaveMode("parallel");
      }
      return;
    }

    scheduler.fastStreak = Math.max(0, scheduler.fastStreak - 1);
  }

  function setSaveMode(mode) {
    state.saveMode = mode;
  }

  function getSaveModeText() {
    return t(state.saveMode === "parallel" ? "modeParallel" : "modeSingle");
  }

  function getTimestamp() {
    if (window.performance && window.performance.now) {
      return window.performance.now();
    }
    return Date.now();
  }

  async function saveItemWithRetry(item) {
    let lastError = null;

    for (let attempt = 0; attempt <= SAVE_RETRY_LIMIT; attempt += 1) {
      try {
        const result = await item.save();
        if (result === false) {
          throw new Error(t("saveFailure"));
        }
        return;
      } catch (error) {
        lastError = error;
        if (attempt < SAVE_RETRY_LIMIT) {
          await wait(SAVE_RETRY_DELAY_MS * (attempt + 1));
        }
      }
    }

    throw lastError || new Error(t("saveFailure"));
  }

  function updateProgress(processed, total, renamed, skipped, failed) {
    const percent = total > 0 ? Math.min(100, (processed / total) * 100) : 0;
    elements.progressText.textContent = `${processed} / ${total}`;
    elements.progressBar.style.width = `${percent}%`;
    setStatus(t("progress", { processed, total, renamed, skipped, failed, mode: getSaveModeText() }));
  }

  function resetProgress(total = 0) {
    elements.progressText.textContent = `0 / ${total}`;
    elements.progressBar.style.width = "0%";
  }

  function updatePerformanceNote(total) {
    if (!elements.performanceNote) {
      return;
    }

    if (total >= STRESS_BATCH_THRESHOLD) {
      elements.performanceNote.textContent = t("performanceStress", { total });
      return;
    }

    if (total > VISIBLE_ROW_LIMIT) {
      elements.performanceNote.textContent = t("performanceVisible", { total, visible: VISIBLE_ROW_LIMIT });
      return;
    }

    if (total >= LARGE_BATCH_THRESHOLD) {
      elements.performanceNote.textContent = t("performanceLarge", { total });
      return;
    }

    elements.performanceNote.textContent = t("performanceDefault");
  }

  function wait(milliseconds) {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }

  function formatNumber(value, digits, pad) {
    const sign = value < 0 ? "-" : "";
    const body = String(Math.abs(value));
    return `${sign}${pad ? body.padStart(digits, "0") : body}`;
  }

  function formatLetters(value, letterCase) {
    const normalized = Math.max(1, Math.floor(value));
    let number = normalized;
    let result = "";

    while (number > 0) {
      number -= 1;
      result = String.fromCharCode(65 + (number % 26)) + result;
      number = Math.floor(number / 26);
    }

    return letterCase === "lower" ? result.toLocaleLowerCase() : result;
  }

  function insertByCharacterPosition(value, position, insertText) {
    const chars = Array.from(value);
    const index = Math.min(chars.length, Math.max(0, position - 1));
    chars.splice(index, 0, insertText);
    return chars.join("");
  }

  function deleteByCharacterRange(value, start, count) {
    const chars = Array.from(value);
    const index = Math.min(chars.length, Math.max(0, start - 1));
    chars.splice(index, count);
    return chars.join("");
  }

  function formatDisplayName(name, ext) {
    if (!ext) {
      return name;
    }

    const suffix = `.${ext}`;
    if (name.toLocaleLowerCase().endsWith(suffix.toLocaleLowerCase())) {
      return name;
    }
    return `${name}${suffix}`;
  }

  function parseInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function findRow(rowId) {
    return state.rows.find((row) => row.id === rowId);
  }

  function setStatus(message) {
    elements.statusText.textContent = message;
  }

  async function notify(message) {
    const eagleApi = getEagleApi();
    if (!eagleApi || !eagleApi.notification) {
      return;
    }

    try {
      await eagleApi.notification.show({
        title: t("notifyTitle"),
        body: message
      });
    } catch (error) {
      console.warn("Notification failed", error);
    }
  }

  async function promptCancelRunningTask() {
    if (!state.running || state.closePromptOpen || state.cancelRequested) {
      return;
    }

    state.closePromptOpen = true;
    try {
      const shouldCancel = await confirmCancelRunningTask();
      if (shouldCancel) {
        state.cancelRequested = true;
        state.closeAfterCancel = true;
        setStatus(t("terminating"));
      }
    } finally {
      state.closePromptOpen = false;
    }
  }

  async function confirmCancelRunningTask() {
    const message = t("closeMessage");
    const detail = t("closeDetail");
    const eagleApi = getEagleApi();

    if (eagleApi && eagleApi.dialog && eagleApi.dialog.showMessageBox) {
      const result = await eagleApi.dialog.showMessageBox({
        type: "warning",
        title: t("taskRunningTitle"),
        message,
        detail,
        buttons: [t("waitButton"), t("cancelButton")],
        defaultId: 0,
        cancelId: 0
      });
      return result && result.response === 1;
    }

    return window.confirm(`${message}\n\n${detail}`);
  }

  function confirmCancelRunningTaskSync() {
    if (state.closePromptOpen) {
      return false;
    }

    state.closePromptOpen = true;
    try {
      return window.confirm(`${t("closeMessage")}\n\n${t("closeDetail")}`);
    } finally {
      state.closePromptOpen = false;
    }
  }

  function allowImmediateCloseAfterCancel() {
    state.cancelRequested = true;
    state.closeAfterCancel = false;
    state.closeAllowed = true;
    window.onbeforeunload = null;
    setStatus(t("terminating"));
    setTimeout(() => {
      window.close();
    }, 0);
  }

  async function applyCurrentTheme() {
    const eagleApi = getEagleApi();
    if (!eagleApi || !eagleApi.app) {
      applyTheme("Auto");
      return;
    }

    applyTheme(eagleApi.app.theme || "Auto");
  }

  function applyTheme(theme) {
    const themeName = resolveThemeName(theme);
    const backgrounds = {
      light: "#f4f5f7",
      lightgray: "#eceff3",
      gray: "#25282e",
      dark: "#16181d",
      blue: "#111827",
      purple: "#1c1726"
    };

    document.documentElement.dataset.theme = themeName;
    setWindowBackground(backgrounds[themeName] || backgrounds.light);
  }

  function resolveThemeName(theme) {
    const normalizedTheme = String(theme || "Auto").toUpperCase();
    const explicitThemes = {
      LIGHT: "light",
      LIGHTGRAY: "lightgray",
      GRAY: "gray",
      DARK: "dark",
      BLUE: "blue",
      PURPLE: "purple"
    };

    if (explicitThemes[normalizedTheme]) {
      return explicitThemes[normalizedTheme];
    }

    if (normalizedTheme === "AUTO" || !normalizedTheme) {
      try {
        const eagleApi = getEagleApi();
        return eagleApi && eagleApi.app && eagleApi.app.isDarkColors && eagleApi.app.isDarkColors()
          ? "dark"
          : "light";
      } catch (error) {
        return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
    }

    return "light";
  }

  async function setWindowBackground(color) {
    const eagleApi = getEagleApi();
    if (!eagleApi || !eagleApi.window || !eagleApi.window.setBackgroundColor) {
      return;
    }

    try {
      await eagleApi.window.setBackgroundColor(color);
    } catch (error) {
      console.warn("Set window background failed", error);
    }
  }

  function getErrorMessage(error) {
    if (!error) {
      return t("unknownError");
    }
    return error.message || String(error);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  const eagleApi = getEagleApi();
  if (eagleApi && typeof eagleApi.onPluginCreate === "function") {
    eagleApi.onPluginCreate(() => {
      initialize();
    });

    if (typeof eagleApi.onPluginShow === "function") {
      eagleApi.onPluginShow(() => {
        applyCurrentTheme();
        initialize();
      });
    }
  } else {
    initialize();
  }

  if (eagleApi && typeof eagleApi.onPluginCreate !== "function" && typeof eagleApi.onPluginRun === "function") {
    eagleApi.onPluginRun(() => {
      applyCurrentTheme();
      initialize();
    });
  }
})();
