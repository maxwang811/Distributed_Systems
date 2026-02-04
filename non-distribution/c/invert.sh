#!/bin/bash



sort | uniq -c | awk '{print $2,$3,$4,"|",$1,"|"}' | sed 's/\s\+/ /g' | sort | sed "s|$| $1|"
