/*
 * (C) 2015 Dennis Schulmeister <dennis@patk.org>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 */

_JSSCRATCH_WEBSITE = "https://www.wikiberd.de/hg/dennis/js_scratch";

/**
 * Initializations on page load
 */
window.addEventListener("load", function() {
    i18n.init();
    editor.init();
    interpreter.init();
});

/**
 * Command functions called by the toolbar buttons
 */
cmd = {
    /**
     * Discard source code and re-initialize editor
     */
    new_source: function() {
        var question = _("Are you sure you want to create a new file?");
        if (!editor.ask_unsaved_changes(question)) return;

        editor.init();
        interpreter.init();

        //////////////////////////77
        interpreter.addEventListener("ready", function() {
            alert("ready");
            interpreter.eval("7 * 7");
        });

    },

    /**
     * Load source code from local file
     */
    open_source: function() {
        var question = _("Are you sure you want to open another file?");
        if (!editor.ask_unsaved_changes(question)) return;

        var file_element = document.createElement("input");
        file_element.type = "file";
        file_element.accept = "text/javascript";

        file_element.addEventListener("change", function() {
            editor.open_file(this.files[0]);
            // TODO: Execute file
        });

        file_element.click();
    },

    /**
     * Save source code to local file
     */
    save_source: function() {
        var filename = editor.filename;
        if (filename == "") filename = "javascript.js";

        var a_element = document.createElement("a");
        a_element.setAttribute("href", editor.get_data_uri());
        a_element.setAttribute("download", filename);

        var event = document.createEvent("MouseEvents");
        event.initEvent("click", true, true);
        a_element.dispatchEvent(event);

        editor.mark_clean();
    },

    /**
     * Open new tab with the JS.Scratch website
     */
    visit_website: function() {
        window.open(_JSSCRATCH_WEBSITE, "_blank");
    },
};

/**
 * Editor object which handles the source code editing, e.g. the "unsaved
 * changes" flag and methods to load and save source codes.
 */
editor = {
    /**
     * Name of the currently edited file
     */
    filename: "",

    /**
     * CodeMirror editor object which contains the source code
     */
    cm_editor: undefined,

    /**
     * Change generation which needs to be checked against cm_editor.changeGeneration()
     * in order to find out whether unsaved changes exist.
     */
    change_generation: -1,

    /**
     * Initialize editor with a new source code
     */
    init: function() {
        // Reset attributes
        this.filename = "";
        this.unsaved_changes = false;

        // Create editor widget
        var textarea = document.getElementById("editor");
        textarea.value = "";

        var default_source = _("Welcome to JS.Scratch") + "\n";
        default_source += Array(default_source.length).join("=") + "\n"
                       + "\n"
                       + _("This is an interactive JavaScript editor.") + "\n"
                       + _("It helps you to easily experiment with JavaScript.") + "\n"
                       + _("Write some code and click \"execute\" to see the result.") + "\n"
                       + "\n"
                       + _("Have fun!");

        default_source.split("\n").forEach(function (line) {
            textarea.value += "// " + line + "\n";
        }, this);

        if (this.cm_editor != undefined) {
            var element = this.cm_editor.getWrapperElement();
            element.parentElement.removeChild(element);
        }

        this.cm_editor = CodeMirror.fromTextArea(textarea, {
            mode: "javascript",
            indentUnit: 4,
            lineNumbers: true,
            showCursorWhenSelecting: true,
        });

        this.mark_clean();
        //var exec_button = document.createElement("button");
        //exec_button.innerHTML = "Ausführen";
        //var source_doc = source_editor.getDoc();
        //source_doc.addLineWidget(0, exec_button.cloneNode(true)); // Geht nicht
    },

    /**
     * Returns:
     *   true if unsaved changes exist
     */
    has_unsaved_changes: function() {
        return this.change_generation != this.cm_editor.changeGeneration();
    },

    /**
     * Mark editor clean as having no unsaved changes.
     */
    mark_clean: function() {
        this.change_generation = this.cm_editor.changeGeneration();
    },

    /**
     * Helper method which asks the user to save the source code if there are
     * unsaved changes. If there are no unsaved changes this methods is a noop.
     *
     * Unfortunately there is no native 3-button message box in JavaScript
     * which would be needed for a "do you want to save [yes] [no] [cancel]"
     * type of question. Therefor the user may only choose to goon or cancel
     * in order to not to depend on another JS library and to keep the source
     * code simpel.
     *
     * Parameters:
     *   question: A question like "Are you sure you want to create a new file?"
     *
     * Returns:
     *   true if the program may go on
     *   false if the user chose cancel
     */
    ask_unsaved_changes: function(question) {
        if (question == "") question = _("Are you sure you want to go on?");
        question = _("There are unsaved changes in your source code.") + " " + question;

        if (this.has_unsaved_changes()) {
            return confirm(question);
        }

        return true;
    },

    /**
     * Discards the source code and opens the given file instead.
     *
     * Parameters:
     *   file: A File object as returned by <input type="file">
     */
    open_file: function(file) {
        // TODO
        this.cm_editor.markClean();
    },

    /**
     * Returns:
     *   A data uri which can be used to save the source code. The uri must
     *   be opened by the browser in any way. The best way is to use a
     *   dynamicly created <a href="data_uri" download="filename"/> element.
     */
    get_data_uri: function() {
        // TODO: Special handling for read-only blocks
        return "data:text/javascript;charset=utf-8," + encodeURIComponent(this.cm_editor.getValue());
    },
};

/**
 * Sandboxed JavaScript environment in which the source code can be executed.
 */
interpreter = {
    /**
     * The <iframe> backend which does the actual sandboxing
     */
    iframe: undefined,
    script: undefined,

    /**
     * Re-initialize the sandbox
     */
    init: function() {
        if (this.iframe != undefined) {
            this.iframe.parentElement.removeChild(this.iframe);
        }

        this.iframe = document.createElement("iframe");
        this.iframe.src = "sandbox.html";
        this.iframe.style.display = "none";
        document.querySelector("body").appendChild(this.iframe);

        this.iframe.contentWindow.send_result = this.on_send_result.bind(this);

        ///////////////// TUT NICHT
        this.iframe.addEventListener("load", (function() {
            this.script = this.iframe.contentDocument.getElementsByTagName("script")[0];

            var ready_event = new CustomEvent("iframe-ready", {
                details: {},
                bubbles: true,
                cancelable: true,
            });

            this.iframe.dispatchEvent(ready_event);
        }).bind(this));
    },

    /**
     * Evaluates the given JavaScript code inside the sandbox.
     *
     * Returns:
     *   The evaluated result just as built-in eval() would
     */
    eval: function(code) {
        var code1 = "try {"
                  + "    send_result("
                  + '        eval("' + code.replace(/\"/g, "\\\"") + '")'
                  + "    );"
                  + "} catch (error) {"
                  + "    send_result(error);"
                  + "}";
        this.script.innerHTML = code1;
    },

    /**
     * Callback called by the sandboxed JavaScript code in order to return
     * the evaluated result back.
     */
    on_send_result: function(result) {
        alert(result); ///
    },
};
