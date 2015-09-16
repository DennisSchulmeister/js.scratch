/*
 * (C) 2015 Dennis Schulmeister <dennis@patk.org>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 */

/**
 * Global object for transaltion services
 * ======================================
 *
 * This is a stand-alone javascript module which can be used to translate
 * html-based web applications.
 *
 * Simple usage:
 *
 *   <!-- Include translations after i18n.js -->
 *   <script src="i18n.js"></script>
 *   <script src="locale/de.js"></script>
 *   <script src="locale/fr.js"></script>
 *
 *   <script>
 *       window.addEventListener("load", i18n.init);
 *   </script>
 *
 * That's all which is needed for simple cases. The module translates the
 * whole web-app according the user's preffered language settings (if they
 * can be determined).
 *
 * Inside the html each element with translatable text needs to be marked
 * with an data-i18n attribute.
 *
 *   <label data-i18n="">String to be translated</label>
 *
 * This enables translation of the element's innerHTML. Image alternative
 * texts (alt attribute) and tooltips (title attribute) are automatically
 * found and translated.
 *
 * Inside JavaScript code the global _(text) function can be used in order
 * to translate a text:
 *
 *   var label = _("Save File");
 *
 * Or
 *
 *   var label = i18n.translate("Save File");
 *
 * whic is identical.
 *
 * All translation services are available through the global i18n object.
 * See the embedded comments for detailed information.
 *
 * Find out the current translation language:
 *
 *   console.log(i18n.current_language);
 *
 * Switch translation on the fly:
 *
 *   i18n.switch_language(["de", "en", "fr"]);
 *   i18n.update_html_translations();
 *
 * How to define translation catalogs
 * ==================================
 *
 * Translations are stored as simple JavaScript dictionaries in a separate
 * file like this:
 *
 *   i18n.language["de"] = {
 *       "New": "Neu",
 *       "Open": "Öffnen",
 *       "Save": "Speichern",
 *   };
 *
 * Language codes must be lower case! It is okay to define a global language
 * like "de" and regional locales like "de-de". In that case both translations
 * will be merged with "de-de" overwriting the texts from the more general "de".
 * This allows to overwrite single texts like this:
 *
 *   i18n.language["de-ch"] = {
 *       "New": "Anlegen",
 *   }
 *
 * All other german texts will be merged with "de-ch" then.
 */
i18n = {
    /**
     * Translations for each language
     * (key: language code, value: dict with translations)
     */
    language: {},

    /**
     * Language code of currently active language
     */
    current_language: "",

    /**
     * Dictionary with current language's text.
     * Equal to language[current_language].
     */
    texts: {},

    /**
     * Init method, must be called on page load.
     *
     * Paramters:
     *   language_code: Desired language code (optional)
     */
    init: function(language_code) {
        var preffered_languages = [];

        if (language_code != undefined) {
            preffered_languages.push(language_code);
        } else if (window.navigator.languages != undefined) {
            preffered_languages = window.navigator.languages;
        } else {
            preffered_languages.push(window.navigator.language);
        }

        this.switch_language(preffered_languages);
        this.update_html_translations();
    },

    /**
     * Get translated text from javascript.
     *
     * Paramters:
     *   text: original text
     * Returns:
     *   Translated text if a translation is available,
     *   the original text otherwise
     */
    translate: function(text) {
        if (text in this.texts) {
            return this.texts[text];
        } else {
            return text;
        }
    },

    /**
     * Switch the currently active language. In order for the change to be
     * visible in the UI the method update_html_transaltions() must be called
     * afterwards.
     *
     *
     * Parameters:
     *   preffered_languages: A list of preffered languages. The first matching
     *     language based on the country will be chonsen. e.g. if "en-us" is
     *     a preffered language, a translation for "en" will be searched first.
     *     Then "en-us" is searched and merged with the cataloge. This allows
     *     to override certain texts for "en-us" without having to copy the
     *     whole translation from "en".
     */
    switch_language: function(preffered_languages) {
        this.current_language = "";
        this.texts = {};

        preffered_languages.forEach(function (language) {
            var found = false;
            var searched_language = "";
            var language_parts = language.toLowerCase().split("-");

            language_parts.forEach(function (part) {
                if (searched_language == "") searched_language = part
                else searched_language += "-" + part;

                if (searched_language in this.language) {
                    found = true;

                    for (var key in this.language[searched_language]) {
                        this.texts[key] = this.language[searched_language][key];
                    }
                }
            }, this);

            if (found) {
                this.current_language = searched_language;
                return;
            }
        }, this);

        return;
    },

    /**
     * This method is automatically called by init() in order to translate all
     * visible strings in the UI. If the language has been manually changed
     * with switch_language() this method must also be called for the change
     * to become visible.
     */
    update_html_translations: function() {
        // Translate all elements marked with data-i18n attribute
        var node_list = document.querySelectorAll("[data-i18n]");

        for (var i = 0; i < node_list.length; i++) {
            var node = node_list[i];

            if (node._i18n_innerHTML == undefined) node._i18n_innerHTML = node.innerHTML;
            node.innerHTML = this.translate(node._i18n_innerHTML);
        }

        // Translate tooltips
        var node_list = document.querySelectorAll("[title]");

        for (var i = 0; i < node_list.length; i++) {
            var node = node_list[i];

            if (node._i18n_title == undefined) node._i18n_title = node.title;
            node.title = this.translate(node._i18n_title);
        }

        // Translate alternative texts
        var node_list = document.querySelectorAll("[alt]");

        for (var i = 0; i < node_list.length; i++) {
            var node = node_list[i];

            if (node._i18n_alt == undefined) node._i18n_alt = node.alt;
            node.alt = this.translate(node._i18n_alt);
        }
    }
};

/**
 * Short-hand for i18n.translate()
 */
_ = i18n.translate.bind(i18n);
