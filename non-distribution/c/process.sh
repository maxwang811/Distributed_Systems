#!/bin/bash




iconv -c -f utf-8 -t ascii//TRANSLIT | \
  tr -cs '[:alpha:]' '\n' | \
  tr '[:upper:]' '[:lower:]' | \
  grep -vxf d/stopwords.txt || true
