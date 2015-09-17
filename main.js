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
    pp.init();
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
            editor.init(false);
            editor.open_file(this.files[0]);
        });

        file_element.click();
    },

    /**
     * Save source code to local file
     */
    save_source: function() {
        if (editor.filename == "") {
            editor.filename = prompt(_("Please enter a file name:"), "javascript.js");

            if (editor.filename == null) {
                editor.filename = "";
            } else {
                editor.filename = editor.filename.trim();
            }

            if (editor.filename == "") return;
        }

        var a_element = document.createElement("a");
        a_element.setAttribute("href", editor.get_data_uri());
        a_element.setAttribute("download", editor.filename);

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
     * <textarea> behind the code editor
     */
    textarea: undefined,

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
     * First line of the source code to be executed. Once the code has run,
     * the code section will be marked read-only and this variable will be
     * changed to the last line of the document.
     */
    execute_first_line: 0,

    /**
     * The widget which is shown below the last line in order to run the code.
     */
    execute_widget: {
        dom: undefined,
        cm: undefined,
    },

    /**
     * The widgets which contain the result of any executed source code. The
     * array contains objects with the following properties:
     *
     *   line: Line number
     *   type: "result" or "output"
     *   result: Raw text content
     *   dom: DOM element inside the code area
     *   cm: cm_editor's proxy object for dom_code
     */
    result_widgets: [],

    /**
     * Initialize editor with a new source code
     *
     * Parameters:
     *   with_default_source: Insert default source with a welcome message
     *      into the editor (default). This is the wanted default behaviour
     *      except when an existing file is opened.
     */
    init: function(with_default_source) {
        // Reset attributes
        this.filename = "";
        this.unsaved_changes = false;
        this.change_generation = -1;
        this.execute_first_line = 0;
        this.result_widgets = [];

        // Create editor instance
        this.textarea = document.getElementById("editor");
        this.textarea.value = "";

        if (with_default_source == undefined || with_default_source == true) {
            var default_source = _("Welcome to JS.Scratch") + "\n";
            default_source += Array(default_source.length).join("=") + "\n"
                           + "\n"
                           + _("This is an interactive JavaScript editor.") + "\n"
                           + _("It helps you to easily experiment with JavaScript.") + "\n"
                           + _("Write some code and click \"execute\" to see the result.") + "\n"
                           + "\n"
                           + _("Have fun!");

            default_source.split("\n").forEach(function (line) {
                this.textarea.value += "// " + line + "\n";
            }, this);
        }

        if (this.cm_editor != undefined) {
            var element = this.cm_editor.getWrapperElement();
            element.parentElement.removeChild(element);
        }

        this.cm_editor = CodeMirror.fromTextArea(this.textarea, {
            mode: "javascript",
            indentUnit: 4,
            lineNumbers: true,
            showCursorWhenSelecting: true,
        });

        this.focus();
        this.mark_clean();

        // Workaround for read-only lines, since this.cm_editor.markText
        // doesn't work
        this.cm_editor.on("beforeChange", (function(cm_editor, change) {
            if (change.from.line < this.execute_first_line) {
                change.cancel();
            }
        }).bind(this));

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
     * Focus editor and place cursor at the end
     */
    focus: function() {
        this.cm_editor.execCommand("goDocEnd");
        this.cm_editor.focus();
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
        // TODO: Execute file and populate editor
        this.cm_editor.markClean();
    },

    /**
     * Returns:
     *   A data uri which can be used to save the source code. The uri must
     *   be opened by the browser in any way. The best way is to use a
     *   dynamicly created <a href="data_uri" download="filename"/> element.
     */
    get_data_uri: function() {
        var content = "";

        for (var line = 0; line < this.cm_editor.lineCount(); line++) {
            // The source line itself
            content += this.cm_editor.getLine(line) + "\n";

            // Add results if existing
            var result_widget = undefined;

            for (var i = 0; i < this.result_widgets.length; i++) {
                result_widget = this.result_widgets[i];
                if (result_widget.line == line) break;
                else result_widget = undefined;
            }

            if (result_widget != undefined) {
                content += "/*** [" + result_widget.type.toUpperCase() + "]\n";

                result_widget.result.split("\n").forEach(function(line) {
                    content += " *** " + line + "\n";
                });

                content += " ***/\n";
            }
        }

        return "data:text/javascript;charset=utf-8," + encodeURIComponent(content);
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
        this.execute_widget.cm = this.cm_editor.addLineWidget(
            last_line,
            this.execute_widget.dom
        );
    },

    /**
     * Inserts a new result widget into the editor. Afterwards the method
     * update_result_widgets must be called in order for the widget to become
     * visible.
     *
     * Parameters:
     *   line: Line number below which the result will be shown
     *   type: "eval" for computed results or "output" for console output
     *   result: innerHTML of the result widget
     *
     * Returns:
     *   The widget object added to this.resultWidgets
     */
    insert_result: function(line, type, result) {
        if (type != "result" && type != "output") type = "result";

        var code_element = document.createElement("div");
        code_element.classList.add("non_code");
        code_element.classList.add(type);
        code_element.innerHTML = "<pre>" + result + "</pre>";

        var result_widget = {
            line: line,
            type: type,
            result: result,
            dom: code_element,
        };

        this.result_widgets.push(result_widget);
        return result_widget;
    },

    /**
     * Reinserts the results into the editor after a change to the source code.
     */
    update_result_widgets: function() {
        var from_line = 0;

        this.result_widgets.forEach(function(widget) {
            // Insert results
            if (widget.cm != undefined) widget.cm.clear();
            widget.cm = this.cm_editor.addLineWidget(widget.line, widget.dom);

            // Highlight read-only lines
            for (var l = from_line; l <= widget.line; l++) {
                this.cm_editor.addLineClass(l, "background", "readonly");
            }
        }.bind(this));
    },

    /**
     * Execute editable source code and show the results below. After that
     * make the source code read-only so that it can neither be changed nor
     * re-executed.
     *
     * Parameters:
     *   newline: Insert a new line afterwards (default). This is really
     *     the wanted behavious because otherwise the user could not enter
     *     more lines. However when an existing file is opened this function
     *     is called within a loop where the auto newline is unwanted.
     */
    execute: function(newline) {
        // Find source code to be executed
        var last_line = this.cm_editor.lastLine();

        var from = {line: this.execute_first_line, ch: 0};
        var to = {line: last_line + 1, ch: 0};
        var source_code = this.cm_editor.getRange(from, to);

        var result_cb = (function(result) {
            // Insert result
            if (result == undefined) {
                result = "";
            } else {
                result = escape_html(pp.to_string(result));
            }

            this.insert_result(last_line, "result", result);

            // Append an empty line
            // Note: All variants with setValue() or getting the source
            // code from the <textare>, updating the <textarea> instead, ...
            // work only the first time they are called!?!? This is the
            // only relaible solution. Fortunately only a new line needs
            // to be added.
            if (newline == undefined || newline == true) {
                this.cm_editor.execCommand("goDocEnd");
                this.cm_editor.execCommand("newlineAndIndent");
                this.cm_editor.save();
                this.focus();
            }

            this.execute_first_line = last_line + 1;
            this.update_result_widgets();
            this.update_execute_widget();
        }).bind(this);

        var output_cb = (function() {
            console.log.apply(console, arguments);
            var output = "";

            for (var i = 0; i < arguments.length; i++) {
                var argument = arguments[i];
                var to_string = escape_html(pp.to_string(argument, true));

                if (output == "") output = to_string;
                else output += " " + to_string;
            }

            this.insert_result(last_line, "output", output);
        }).bind(this);

        interpreter.eval(source_code, result_cb, output_cb);
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

        if (callback != undefined) {
            this.iframe.addEventListener("load", (function() {
                callback();
            }).bind(this));
        }
    },

    /**
     * Evaluates the given JavaScript code inside the sandbox.
     *
     * Parameters:
     *   code: The code to be executed
     *   result_cb: A callback function with a single argument. This function
     *     is called in order to return the evaluated result. (optional)
     *   output_cb: Replacement function for console.log(...) (optional)
     *
     * Returns:
     *   Nothing since the given JavaScript code is evaluated asynchroniously
     *   inside an <iframe> jail. Since there is no sensible way to block in
     *   JavaScript the evaluated result is returen via a callback function.
     */
    eval: function(code, result_cb, output_cb) {
        if (result_cb != undefined) {
            this.iframe.contentWindow._result_cb = result_cb;
        } else {
            this.iframe.contentWindow._result_cb = function(result) {};
        }

        if (output_cb != undefined) {
            if ((this.iframe.contentWindow.console != undefined)
                && (this.iframe.contentWindow.console.log != undefined)) {
                    this.iframe.contentWindow.console.log = output_cb;
                }
        }

        code = code.replace(/\"/g, "\\\"");
        code = code.replace(/\n/g, "\\n");

        var code1 = "try {"
                  + "    _result_cb("
                  + '        eval("' + code + '")'
                  + "    );"
                  + "} catch (error) {"
                  + "    _result_cb(error);"
                  + "}";

        var script = this.iframe.contentDocument.createElement("script");
        script.innerHTML = code1;
        this.iframe.contentDocument.querySelector("head").appendChild(script);
    },
};

/**
 * Pretty printer to serialize values to strings.
 */
pp = {
    /**
     * A WeakMap to store all known object ids
     */
    object_ids: undefined,

    /**
     * Counter to generate the obejct ids
     */
    id_counter: 0,

    /**
     * Initialize pretty printer. This is needed in order to choose an
     * implementation for generating object ids.
     */
    init: function() {
        if (window.WeakMap == undefined) {
            // Fallback implementartion: Extend Object prototype
            // See: http://stackoverflow.com/a/2020890
            this.get_object_id = this.get_object_id_fallback;

            Object.prototype._id = function() {
                pp.id_counter += 1;

                var id = pp.id_counter;
                this._id = function() { return id; }
                return id;
            };
        } else {
            // Default implementation: Uses a WeakMap
            this.object_ids = new WeakMap();
        }
    },

    /**
     * Serialize object into a nice string representation.
     *
     * Parameters:
     *   obj: The object or value to serialize
     *   short: True if strings should be returned as is
     * Returns:
     *   A human-readable string
     */
    to_string: function(obj, short) {
        var seen_objects = [];
        var indent = 0;

        function _get_indent(amount) {
            var chars = "";

            if (amount > 0) {
                for (var i = 0; i < amount; i++) chars += " ";
            }

            return chars;
        }

        function _is_error(obj) {
            var root = Object.getPrototypeOf(Object);
            var proto = obj;

            while (proto != root && proto != null) {
                if (String(proto) == "Error") return true;
                proto = Object.getPrototypeOf(proto);
            }

            return false;
        }

        function _to_string(obj, short) {
            indent += 4;
            var string = "";

            if (obj == null) {
                string = "null";
            } else if (Array.isArray(obj)) {
                string = "array";
            } else if (_is_error(obj)) {
                string = "error";
            } else {
                string = typeof(obj);
            }

            switch (string) {
                case "undefined":
                    break;
                case "null":
                    break;
                case "string":
                    if (short == true) string = obj;
                    else string += ' "' + obj + '"';
                    break;
                case "array":
                    var id = this.get_object_id(obj);

                    if (seen_objects.indexOf(id) >= 0) {
                        string += ":" + id + " [ … ]";
                    } else {
                        seen_objects.push(id);
                        string += ":" + id + " [\n";

                        for (var i = 0; i < obj.length; i++) {
                            string += _get_indent(indent) + i + ": " + _to_string(obj[i], short) + ",\n";
                        }

                        string += _get_indent(indent - 4) + "]";
                        seen_objects.pop();
                    }

                    break;
                case "object":
                    var id = this.get_object_id(obj);

                    if (seen_objects.indexOf(id) >= 0) {
                        string += ":" + id + " { … }";
                    } else {
                        seen_objects.push(id);
                        string += ":" + id + " {\n"

                        var keys = Object.keys(obj).sort();

                        for (var i = 0; i < keys.length; i++) {
                            var key = keys[i];
                            string += _get_indent(indent) + key + ": " + _to_string(obj[key], short) + ",\n";
                        }

                        string += _get_indent(indent - 4) + "}";
                        seen_objects.pop();
                    }

                    break;
                case "function":
                case "error":
                    string = String(obj);
                    break;
                default:
                    string += " " + String(obj);
            }

            indent -= 4;
            return string;
        }

        _to_string = _to_string.bind(this);
        return _to_string(obj, short);
    },

    /**
     * Create a unique id for the given object. This is the default
     * implementation which uses a WeakMap to store the obejct ids.
     */
    get_object_id: function(obj) {
        if (obj == null) return 0;
        if (typeof(obj) != "object") return -1;

        if (this.object_ids.has(obj)) {
            return this.object_ids.get(obj);
        } else {
            this.id_counter += 1;
            this.object_ids.set(obj, this.id_counter);
            return this.id_counter;
        }
    },

    /**
     * Create a unique id for the given object. This is the fallback
     * implementation which extends the Object prototype to store the
     * obejct ids.
     */
    get_object_id_fallback: function(obj) {
        if (obj == null) return 0;
        if (typeof(obj) != "object") return -1;
        if (obj._id == undefined) return -1;

        else return obj._id();
    },
}

/**
 * Utility function to escape html special characters.
 *
 * Parameters:
 *   text: Origninal text with html tags, e.g. "<h1>test</h1>".
 * Returns:
 *   Escaped string, e.g. "&lt;h1&gt;test&lt&&#47;h1&gt;".
 */
function escape_html(text) {
    text = text.replace("&", "&amp;");
    text = text.replace("<", "&lt;");
    text = text.replace(">", "&gt;");
    text = text.replace("/", "&#47;");

    return text;
}
