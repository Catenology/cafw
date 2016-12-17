---
layout: post
title:  "Placeholders"
date:   2016-01-03 14:50:21 -0700
categories: style
---
{% assign placeholders = site.static_files | where:"extname",".jpg" %}
{% for placeholder in placeholders %}
- <img src="{{ placeholder.path }}" alt="{{ placeholder.name }}" class="img-responsive" />
  - {{ placeholder.path | prepend: site.url }}
{% endfor %}
