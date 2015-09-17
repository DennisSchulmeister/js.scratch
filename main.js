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
        interpreter.init(function() {});
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
     * The widget which is shown below the last line in order to run the code.
     */
    execute_widget: {
        dom: undefined,
        cm: undefined,
    },

    /**
     * Initialize editor with a new source code
     */
    init: function() {
        // Reset attributes
        this.filename = "";
        this.unsaved_changes = false;

        // Create editor instance
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

        // Create widget to run the source code
        this.execute_widget.line = -1;

        if (this.execute_widget.dom == undefined) {
            this.execute_widget.dom = document.createElement("div");
            this.execute_widget.dom.classList.add("toolbar");
            this.execute_widget.dom.classList.add("inline");

            this.execute_widget.dom.innerHTML = "<button title='" + _("Execute code and show result") + "' onclick='editor.execute()'>"
                                              + "  <span class='icon-terminal' aria-hidden='true'></span>"
                                              + "  <label data-i18n=''>" + _("Execute") + "</label>"
                                              + "</button>";
        }

        this.update_execute_widget();
        this.cm_editor.on("change", this.update_execute_widget.bind(this));
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

    /**
     * keypress event handler which makes sure that below the very last line
     * a widget will be visible to run the source code.
     */
    update_execute_widget: function() {
        if (this.execute_widget.cm != undefined) {
            this.execute_widget.cm.clear();
        }

        var last_line = this.cm_editor.lastLine();
        var doc = this.cm_editor.getDoc();

        this.execute_widget.cm = doc.addLineWidget(last_line, this.execute_widget.dom);
    },

    /**
     * Execute editable source code and show the results below. After that
     * make the source code read-only so that it can neither be changed nor
     * re-executed.
     */
    execute: function() {
        // Find source code to be executed
        // Execute and receive result
        // Insert result widget
        // Append an empty line --> how??
        this.update_execute_widget();
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
     *
     * Parameters:
     *   callback: Function which is called once the <iframe> jail has finished
     *     loading and the sandbox is ready. (optional)
     */
    init: function(callback) {
        if (this.iframe != undefined) {
            this.iframe.parentElement.removeChild(this.iframe);
        }

        this.iframe = document.createElement("iframe");
        this.iframe.src = "sandbox.html";
        this.iframe.style.display = "none";
        document.querySelector("body").appendChild(this.iframe);

        this.iframe.addEventListener("load", (function() {
            this.script = this.iframe.contentDocument.querySelector("script");
            if (callback != undefined) callback();
        }).bind(this));
    },

    /**
     * Evaluates the given JavaScript code inside the sandbox.
     *
     * Parameters:
     *   code: The code to be executed
     *   callback: A callback function with a single argument. This function
     *     is called in order to return the evaluated result. (optional)
     *
     * Returns:
     *   Nothing since the given JavaScript code is evaluated asynchroniously
     *   inside an <iframe> jail. Since there is no sensible way to block in
     *   JavaScript the evaluated result is returen via a callback function.
     */
    eval: function(code, callback) {
        if (callback != undefined) {
            this.iframe.contentWindow._callback = callback;
        } else {
            this.iframe.contentWindow._callback = function(result) {};
        }

        var code1 = "try {"
                  + "    _callback("
                  + '        eval("' + code.replace(/\"/g, "\\\"") + '")'
                  + "    );"
                  + "} catch (error) {"
                  + "    _callback(error);"
                  + "}";

        this.script.innerHTML = code1;
    },
};
