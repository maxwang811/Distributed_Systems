#!/bin/bash


awk '
  {
    terms[NR] = $0
    print $0
    if (NR >= 2) print terms[NR-1] "\t" terms[NR]
    if (NR >= 3) print terms[NR-2] "\t" terms[NR-1] "\t" terms[NR]
  }
'
