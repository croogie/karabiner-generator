(() => {
  "use strict";
  const GROUPS_KEY = "karabiner-launcher-groups-v1";
  const LEGACY_ROWS_KEY = "karabiner-tab-launcher-rows-v1";
  const LEGACY_TRIGGER_KEY = "karabiner-launcher-trigger-v1";
  const LEGACY_NAME_KEY = "karabiner-launcher-rule-name-v1";
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const kinds = ["name", "bundle_identifier", "file_path", "uri", "command"];
  const defaults = [
    { key: "s", name: "Safari", kind: "name", target: "" },
    { key: "c", name: "Google Chrome", kind: "name", target: "" },
    { key: "f", name: "Finder", kind: "name", target: "" },
  ];
  const groupsEl = document.querySelector("#groups");
  const countEl = document.querySelector("#count");
  const feedbackEl = document.querySelector("#feedback");
  const outputEl = document.querySelector("#output");
  const outputTitleEl = document.querySelector("#output-title");
  const instructionsEl = document.querySelector("#output-instructions");
  const resultsEl = document.querySelector("#rule-outputs");
  const importPanelEl = document.querySelector("#import-panel");
  const toggleImportEl = document.querySelector("#toggle-import");
  let generatedRules = [];

  function readJSON(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  }
  function readText(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function normalizeRow(item) {
    return {
      key: typeof item?.key === "string" ? item.key : "",
      name: typeof item?.name === "string" ? item.name : "",
      kind: kinds.includes(item?.kind) ? item.kind : "name",
      target: typeof item?.target === "string" ? item.target : "",
    };
  }
  function normalizeGroup(item) {
    const trigger =
      typeof item?.trigger === "string" &&
      ["tab", "caps_lock", "escape", ...letters].includes(item.trigger)
        ? item.trigger
        : "tab";
    return {
      trigger,
      name: typeof item?.name === "string" ? item.name : "App launcher",
      rows: Array.isArray(item?.rows)
        ? item.rows
            .filter((row) => row && typeof row === "object")
            .map(normalizeRow)
        : [],
    };
  }
  function loadGroups() {
    const saved = readJSON(GROUPS_KEY);
    if (Array.isArray(saved) && saved.length)
      return saved
        .filter((item) => item && typeof item === "object")
        .map(normalizeGroup);
    const previousRows = readJSON(LEGACY_ROWS_KEY);
    return [
      normalizeGroup({
        trigger: readText(LEGACY_TRIGGER_KEY) || "tab",
        name: readText(LEGACY_NAME_KEY) || "App launcher",
        rows: Array.isArray(previousRows) ? previousRows : defaults,
      }),
    ];
  }
  let groups = loadGroups();

  function persist() {
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    } catch {
      /* Editing still works without storage. */
    }
  }
  function say(message, good = false) {
    feedbackEl.textContent = message;
    feedbackEl.classList.toggle("ok", good);
  }
  function invalidate() {
    generatedRules = [];
    outputEl.hidden = true;
    say("");
  }
  function option(value, label, selected) {
    const el = document.createElement("option");
    el.value = value;
    el.textContent = label;
    el.selected = value === selected;
    return el;
  }
  function labelForTrigger(trigger) {
    if (trigger === "tab") return "Tab";
    if (trigger === "caps_lock") return "Caps Lock";
    if (trigger === "escape") return "Escape";
    return trigger.toUpperCase();
  }
  function field(label, element) {
    const container = document.createElement("div");
    container.className = "field";
    const caption = document.createElement("label");
    caption.textContent = label;
    container.append(caption, element);
    return container;
  }
  function renderRow(group, row, groupIndex, rowIndex) {
    const wrapper = document.createElement("div");
    wrapper.className = "row";
    const keySelect = document.createElement("select");
    keySelect.setAttribute(
      "aria-label",
      `Shortcut key ${rowIndex + 1} in group ${groupIndex + 1}`
    );
    keySelect.append(option("", "—", row.key));
    for (const letter of letters)
      keySelect.append(option(letter, letter.toUpperCase(), row.key));
    keySelect.addEventListener("change", () => {
      row.key = keySelect.value;
      persist();
      invalidate();
    });

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = row.name;
    nameInput.placeholder = "e.g. Record audio";
    nameInput.autocomplete = "off";
    nameInput.setAttribute(
      "aria-label",
      `Action label ${rowIndex + 1} in group ${groupIndex + 1}`
    );
    nameInput.addEventListener("input", () => {
      row.name = nameInput.value;
      persist();
      invalidate();
    });

    const targetGroup = document.createElement("div");
    targetGroup.className = "target";
    const kindSelect = document.createElement("select");
    kindSelect.setAttribute(
      "aria-label",
      `Action type ${rowIndex + 1} in group ${groupIndex + 1}`
    );
    kindSelect.append(
      option("name", "Name", row.kind),
      option("bundle_identifier", "Bundle ID", row.kind),
      option("file_path", "App path", row.kind),
      option("uri", "URI", row.kind),
      option("command", "Command", row.kind)
    );
    const placeholders = {
      bundle_identifier: "com.example.app",
      file_path: "/Applications/App.app",
      uri: "superwhisper://record",
      command: "/path/to/script test",
    };
    const targetInput = document.createElement("input");
    targetInput.type = "text";
    targetInput.value = row.target;
    targetInput.hidden = row.kind === "name";
    targetInput.placeholder = placeholders[row.kind] || "";
    targetInput.spellcheck = false;
    targetInput.autocapitalize = "off";
    targetInput.autocomplete = "off";
    targetInput.setAttribute(
      "aria-label",
      `Action target ${rowIndex + 1} in group ${groupIndex + 1}`
    );
    kindSelect.addEventListener("change", () => {
      row.kind = kindSelect.value;
      targetInput.hidden = row.kind === "name";
      targetInput.placeholder = placeholders[row.kind] || "";
      persist();
      invalidate();
    });
    targetInput.addEventListener("input", () => {
      row.target = targetInput.value;
      persist();
      invalidate();
    });
    targetGroup.append(kindSelect, targetInput);
    const targetField = field("Action type and target", targetGroup);
    targetField.classList.add("target-field");

    const remove = document.createElement("button");
    remove.className = "remove";
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute(
      "aria-label",
      `Remove shortcut ${rowIndex + 1} from group ${groupIndex + 1}`
    );
    remove.addEventListener("click", () => {
      group.rows.splice(rowIndex, 1);
      persist();
      invalidate();
      render();
    });
    wrapper.append(
      field("Key", keySelect),
      field("Label / application", nameInput),
      targetField,
      remove
    );
    return wrapper;
  }
  function render() {
    groupsEl.replaceChildren();
    groups.forEach((group, groupIndex) => {
      const card = document.createElement("article");
      card.className = "group";
      const head = document.createElement("div");
      head.className = "group-head";
      const title = document.createElement("h3");
      title.textContent = `Group ${groupIndex + 1}`;
      head.append(title);
      if (groups.length > 1) {
        const remove = document.createElement("button");
        remove.className = "btn secondary";
        remove.type = "button";
        remove.textContent = "Remove group";
        remove.setAttribute(
          "aria-label",
          `Remove trigger group ${groupIndex + 1}`
        );
        remove.addEventListener("click", () => {
          groups.splice(groupIndex, 1);
          persist();
          invalidate();
          render();
        });
        head.append(remove);
      }
      const fields = document.createElement("div");
      fields.className = "group-fields";
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = group.name;
      nameInput.placeholder = "e.g. Work apps";
      nameInput.autocomplete = "off";
      nameInput.setAttribute(
        "aria-label",
        `Rule name for group ${groupIndex + 1}`
      );
      nameInput.addEventListener("input", () => {
        group.name = nameInput.value;
        persist();
        invalidate();
      });
      const triggerSelect = document.createElement("select");
      triggerSelect.setAttribute(
        "aria-label",
        `Trigger key for group ${groupIndex + 1}`
      );
      triggerSelect.append(
        option("tab", "Tab", group.trigger),
        option("caps_lock", "Caps Lock", group.trigger),
        option("escape", "Escape", group.trigger)
      );
      for (const letter of letters)
        triggerSelect.append(
          option(letter, letter.toUpperCase(), group.trigger)
        );
      const note = document.createElement("p");
      note.className = "group-note";
      function updateNote() {
        note.textContent =
          letters.includes(group.trigger) && group.trigger.length === 1
            ? "Tap the letter to type it. Chording can affect fast typing."
            : "Tap the trigger on its own to send its normal key.";
      }
      triggerSelect.addEventListener("change", () => {
        group.trigger = triggerSelect.value;
        updateNote();
        persist();
        invalidate();
        if (
          groups.some(
            (other) => other !== group && other.trigger === group.trigger
          )
        )
          say(
            `Trigger ${labelForTrigger(group.trigger)} is already used by another group.`
          );
      });
      fields.append(
        field("Rule name", nameInput),
        field("Trigger key", triggerSelect)
      );
      updateNote();
      const rowsEl = document.createElement("div");
      rowsEl.className = "rows";
      group.rows.forEach((row, rowIndex) =>
        rowsEl.append(renderRow(group, row, groupIndex, rowIndex))
      );
      const actions = document.createElement("div");
      actions.className = "group-actions";
      const add = document.createElement("button");
      add.type = "button";
      add.className = "btn secondary";
      add.textContent = "＋ Add shortcut";
      add.addEventListener("click", () => {
        const used = new Set(group.rows.map((row) => row.key));
        const key = [...letters].find(
          (letter) => letter !== group.trigger && !used.has(letter)
        );
        if (!key) return say("No unused letter is available in this group.");
        group.rows.push({ key, name: "", kind: "name", target: "" });
        persist();
        invalidate();
        render();
        groupsEl.children[groupIndex]
          .querySelector(".row:last-child input")
          .focus();
      });
      actions.append(add);
      card.append(head, fields, note, rowsEl, actions);
      groupsEl.append(card);
    });
    const shortcuts = groups.reduce(
      (total, group) => total + group.rows.length,
      0
    );
    countEl.textContent = `${groups.length} ${groups.length === 1 ? "group" : "groups"} · ${shortcuts} ${shortcuts === 1 ? "shortcut" : "shortcuts"}`;
  }
  function validate() {
    const triggers = new Set();
    for (const group of groups) {
      const trigger = group.trigger;
      if (!group.name.trim())
        return `Enter a rule name for the ${labelForTrigger(trigger)} group.`;
      if (triggers.has(trigger))
        return `Trigger ${labelForTrigger(trigger)} is assigned to more than one group.`;
      triggers.add(trigger);
      if (!group.rows.length)
        return `Add at least one shortcut to ${group.name.trim()}.`;
      const used = new Set();
      for (const row of group.rows) {
        const key = row.key.trim().toLowerCase();
        if (!/^[a-z]$/.test(key))
          return `Choose a letter for every shortcut in ${group.name.trim()}.`;
        if (key === trigger)
          return `${key.toUpperCase()} cannot be both trigger and shortcut in ${group.name.trim()}.`;
        if (used.has(key))
          return `${key.toUpperCase()} is assigned twice in ${group.name.trim()}.`;
        used.add(key);
        if (!row.name.trim())
          return `Enter a label for ${labelForTrigger(trigger)}+${key.toUpperCase()}.`;
        if (row.kind !== "name" && !row.target.trim())
          return `Enter a target for ${row.name.trim()}.`;
        if (row.kind === "file_path" && !row.target.trim().startsWith("/"))
          return `The path for ${row.name.trim()} must start with /.`;
        if (
          row.kind === "uri" &&
          !/^[a-z][a-z0-9+.-]*:/i.test(row.target.trim())
        )
          return `Enter a valid URI for ${row.name.trim()}.`;
      }
    }
    for (const group of groups) {
      for (const other of groups) {
        if (
          group !== other &&
          letters.includes(group.trigger) &&
          group.trigger.length === 1 &&
          other.rows.some((row) => row.key === group.trigger)
        )
          return `${group.trigger.toUpperCase()} is a trigger in one group and a shortcut in another. Change one to avoid a rule priority conflict.`;
      }
    }
    return "";
  }
  function shellQuote(value) {
    return "'" + value.replace(/'/g, "'\\''") + "'";
  }
  function action(row) {
    if (row.kind === "name")
      return [
        { shell_command: `/usr/bin/open -a ${shellQuote(row.name.trim())}` },
      ];
    if (row.kind === "uri")
      return [
        { shell_command: `/usr/bin/open ${shellQuote(row.target.trim())}` },
      ];
    if (row.kind === "command") return [{ shell_command: row.target.trim() }];
    return [
      {
        software_function: {
          open_application: { [row.kind]: row.target.trim() },
        },
      },
    ];
  }
  function buildRule(group) {
    const variable = `${group.trigger}_launcher`;
    const alone = { key_code: group.trigger };
    if (group.trigger === "caps_lock") alone.hold_down_milliseconds = 200;
    return {
      description: group.name.trim(),
      manipulators: [
        {
          type: "basic",
          from: { key_code: group.trigger },
          to: [{ set_variable: { name: variable, value: 1 } }],
          to_after_key_up: [{ set_variable: { name: variable, value: 0 } }],
          to_if_alone: [alone],
        },
        ...group.rows.map((row) => ({
          type: "basic",
          from: { key_code: row.key },
          conditions: [{ type: "variable_if", name: variable, value: 1 }],
          to: action(row),
        })),
      ],
    };
  }
  function importedAction(manipulator, index) {
    const target = manipulator.to;
    if (
      !Array.isArray(target) ||
      target.length !== 1 ||
      !target[0] ||
      typeof target[0] !== "object"
    )
      throw new Error(
        `Shortcut ${index}: only a single command or application action can be edited.`
      );
    const item = target[0];
    if (
      typeof item.shell_command === "string" &&
      Object.keys(item).length === 1
    ) {
      const command = item.shell_command;
      const app = command.match(/^\/usr\/bin\/open -a ('(?:[^']|'\\'')*')$/);
      const uri = command.match(/^\/usr\/bin\/open ('(?:[^']|'\\'')*')$/);
      const unquote = (value) => value.slice(1, -1).replace(/'\\''/g, "'");
      if (app) return { name: unquote(app[1]), kind: "name", target: "" };
      if (uri && /^[a-z][a-z0-9+.-]*:/i.test(unquote(uri[1])))
        return { name: unquote(uri[1]), kind: "uri", target: unquote(uri[1]) };
      return {
        name: command.length > 48 ? `${command.slice(0, 45)}…` : command,
        kind: "command",
        target: command,
      };
    }
    const app = item.software_function?.open_application;
    if (Object.keys(item).length === 1 && app && typeof app === "object") {
      const keys = Object.keys(app);
      if (
        keys.length === 1 &&
        ["bundle_identifier", "file_path"].includes(keys[0]) &&
        typeof app[keys[0]] === "string"
      )
        return {
          name: app[keys[0]].split("/").pop() || app[keys[0]],
          kind: keys[0],
          target: app[keys[0]],
        };
    }
    throw new Error(
      `Shortcut ${index}: its action is not supported by this generator.`
    );
  }
  function importRule(raw) {
    let rule;
    try {
      rule = JSON.parse(raw);
    } catch {
      throw new Error(
        "The pasted text is not valid JSON. Copy the entire rule from Edit."
      );
    }
    if (
      !rule ||
      Array.isArray(rule) ||
      typeof rule !== "object" ||
      !Array.isArray(rule.manipulators) ||
      typeof rule.description !== "string"
    )
      throw new Error(
        "Paste one rule with a description and manipulators, as shown under Edit."
      );
    if (
      Object.keys(rule).some(
        (key) => !["description", "manipulators"].includes(key)
      )
    )
      throw new Error(
        "This rule contains additional settings that this generator cannot safely reconstruct."
      );
    const allowedTriggers = ["tab", "caps_lock", "escape", ...letters];
    const triggerManipulators = rule.manipulators.filter(
      (manipulator) =>
        manipulator?.type === "basic" &&
        allowedTriggers.includes(manipulator.from?.key_code) &&
        Array.isArray(manipulator.to) &&
        manipulator.to.some((item) => item?.set_variable)
    );
    if (triggerManipulators.length !== 1)
      throw new Error(
        "This rule must contain exactly one Tab, Caps Lock, Escape, or letter launcher trigger."
      );
    const triggerManipulator = triggerManipulators[0];
    const trigger = triggerManipulator.from.key_code;
    const variable = triggerManipulator.to[0]?.set_variable?.name;
    if (
      typeof variable !== "string" ||
      !variable ||
      triggerManipulator.to.length !== 1 ||
      triggerManipulator.to[0].set_variable.value !== 1 ||
      !Array.isArray(triggerManipulator.to_after_key_up) ||
      triggerManipulator.to_after_key_up.length !== 1 ||
      triggerManipulator.to_after_key_up[0]?.set_variable?.name !== variable ||
      triggerManipulator.to_after_key_up[0].set_variable.value !== 0 ||
      !Array.isArray(triggerManipulator.to_if_alone) ||
      triggerManipulator.to_if_alone.length !== 1 ||
      triggerManipulator.to_if_alone[0]?.key_code !== trigger ||
      Object.keys(triggerManipulator.to_if_alone[0]).some(
        (key) => !["key_code", "hold_down_milliseconds"].includes(key)
      ) ||
      (trigger === "caps_lock" &&
        triggerManipulator.to_if_alone[0].hold_down_milliseconds !== 200) ||
      (trigger !== "caps_lock" &&
        triggerManipulator.to_if_alone[0].hold_down_milliseconds !==
          undefined) ||
      Object.keys(triggerManipulator.to[0]).some(
        (key) => key !== "set_variable"
      ) ||
      Object.keys(triggerManipulator.to[0].set_variable).some(
        (key) => !["name", "value"].includes(key)
      ) ||
      Object.keys(triggerManipulator.to_after_key_up[0]).some(
        (key) => key !== "set_variable"
      ) ||
      Object.keys(triggerManipulator.to_after_key_up[0].set_variable).some(
        (key) => !["name", "value"].includes(key)
      ) ||
      Object.keys(triggerManipulator.from).some((key) => key !== "key_code") ||
      Object.keys(triggerManipulator).some(
        (key) =>
          !["type", "from", "to", "to_after_key_up", "to_if_alone"].includes(
            key
          )
      )
    )
      throw new Error(
        "The launcher trigger has settings this generator cannot safely reconstruct."
      );
    const rows = rule.manipulators
      .filter((item) => item !== triggerManipulator)
      .map((manipulator, index) => {
        const key = manipulator?.from?.key_code;
        if (
          manipulator?.type !== "basic" ||
          typeof key !== "string" ||
          !/^[a-z]$/.test(key) ||
          Object.keys(manipulator.from).some((field) => field !== "key_code") ||
          !Array.isArray(manipulator.conditions) ||
          manipulator.conditions.length !== 1 ||
          manipulator.conditions[0]?.type !== "variable_if" ||
          manipulator.conditions[0].name !== variable ||
          manipulator.conditions[0].value !== 1 ||
          Object.keys(manipulator.conditions[0]).some(
            (field) => !["type", "name", "value"].includes(field)
          ) ||
          Object.keys(manipulator).some(
            (field) => !["type", "from", "conditions", "to"].includes(field)
          )
        )
          throw new Error(
            `Shortcut ${index + 1}: expected a letter assigned to this launcher's variable.`
          );
        return { key, ...importedAction(manipulator, index + 1) };
      });
    const group = { trigger, name: rule.description, rows };
    if (!rows.length || !group.name.trim())
      throw new Error("The rule needs a name and at least one shortcut.");
    return group;
  }
  async function copy(textToCopy, node) {
    try {
      if (navigator.clipboard && window.isSecureContext)
        await navigator.clipboard.writeText(textToCopy);
      else {
        const selection = window.getSelection(),
          range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
        if (!document.execCommand("copy")) throw new Error("Copy unavailable");
        selection.removeAllRanges();
      }
      say("Rule JSON copied to the clipboard.", true);
    } catch {
      say(
        "Could not copy automatically. Select the rule JSON and copy it manually."
      );
    }
  }
  function renderOutput() {
    resultsEl.replaceChildren();
    outputTitleEl.textContent = `${generatedRules.length} ${generatedRules.length === 1 ? "rule" : "rules"} ready`;
    instructionsEl.textContent =
      generatedRules.length === 1
        ? "Copy this rule into Complex Modifications → Add your own rule."
        : "Copy each rule separately into Complex Modifications → Add your own rule. Alternatively, download the bundle, save it in ~/.config/karabiner/assets/complex_modifications/, then enable its rules via Add predefined rule.";
    generatedRules.forEach((rule, index) => {
      const article = document.createElement("article");
      article.className = "rule-output";
      const head = document.createElement("div");
      head.className = "rule-output-head";
      const title = document.createElement("h3");
      title.textContent = rule.description;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn secondary";
      button.textContent = "Copy rule";
      button.setAttribute(
        "aria-label",
        `Copy rule ${index + 1}: ${rule.description}`
      );
      const pre = document.createElement("pre"),
        code = document.createElement("code");
      const json = JSON.stringify(rule, null, 2);
      code.textContent = json;
      pre.append(code);
      button.addEventListener("click", () => copy(json, code));
      head.append(title, button);
      article.append(head, pre);
      resultsEl.append(article);
    });
    outputEl.hidden = false;
    outputEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  document.querySelector("#add-group").addEventListener("click", () => {
    const used = new Set(groups.map((group) => group.trigger));
    const trigger = ["escape", "caps_lock", "tab", ...letters].find(
      (candidate) => !used.has(candidate)
    );
    if (!trigger) return say("No unused trigger key is available.");
    groups.push({
      trigger,
      name: `${labelForTrigger(trigger)} launcher`,
      rows: [
        {
          key: trigger === "a" ? "b" : "a",
          name: "",
          kind: "name",
          target: "",
        },
      ],
    });
    persist();
    invalidate();
    render();
    groupsEl.lastElementChild.querySelector(".row input").focus();
  });
  function setImportOpen(open) {
    importPanelEl.hidden = !open;
    toggleImportEl.setAttribute("aria-expanded", String(open));
    toggleImportEl.textContent = open ? "Hide import" : "Import rule";
    if (open) document.querySelector("#import-json").focus();
  }
  toggleImportEl.addEventListener("click", () =>
    setImportOpen(importPanelEl.hidden)
  );
  document.querySelector("#import-rule").addEventListener("click", () => {
    try {
      const group = importRule(
        document.querySelector("#import-json").value.trim()
      );
      const previous = groups;
      groups = [group];
      const error = validate();
      if (error) {
        groups = previous;
        throw new Error(error);
      }
      persist();
      invalidate();
      render();
      document.querySelector("#import-json").value = "";
      setImportOpen(false);
      say(
        `Imported ${group.name} with ${group.rows.length} ${group.rows.length === 1 ? "shortcut" : "shortcuts"}. You can now edit its keys.`,
        true
      );
      groupsEl.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      say(error.message);
    }
  });
  document.querySelector("#generate").addEventListener("click", () => {
    const error = validate();
    if (error) {
      invalidate();
      return say(error);
    }
    generatedRules = groups.map(buildRule);
    renderOutput();
    say(
      `${generatedRules.length} ${generatedRules.length === 1 ? "rule is" : "rules are"} ready.`,
      true
    );
  });
  document.querySelector("#download").addEventListener("click", () => {
    const payload =
      generatedRules.length === 1
        ? generatedRules[0]
        : { title: "App launcher rules", rules: generatedRules };
    const blob = new Blob([JSON.stringify(payload, null, 2) + "\n"], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "karabiner-launcher-rules.json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say("JSON file downloaded.", true);
  });
  render();
})();
