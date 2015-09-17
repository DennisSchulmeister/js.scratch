JS.Scratch - An interactive JavaScript editor
=============================================

![Screenshot](screenshot.png)

Introduction
------------

This is a small web application which displays an interactive JavaScript code
editor. It was created when I needed an easy to use read-eval-print-loop editor
for my lectures at DHBW Karlsruhe. While all modern browsers have an interactive
JavaScript console none of them allows multi line input. Therefor this project
was created.

Usage is most easy. Simply enter some source code and press "Execute" below.
The code will be evaluated and the result will be shown. After that the existing
code is made read-only so that only new code may be appended. Though counter-
intuitive at first this makes sense. Because changing the source code would
affect all subsequent lines and could render them not working.

As an added bonus the source code can be locally saved and later loaded again.
Also the application chooses between English and German localization depending
on the browser's preferred language settings. Additional translations can
easily be added.

License
-------
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

Resources
---------

Website: http://www.pingu-mobil.de/js/
Source code: https://www.wikiberd.de/hg/dennis/js_scratch
