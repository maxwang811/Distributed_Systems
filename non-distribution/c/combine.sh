#!/bin/bash

# Combine terms to create n-grams (for n=1,2,3)
# Usage: ./combine.sh < terms > n-grams

awk '
  {
    terms[NR] = $0
    print $0
    if (NR >= 2) print terms[NR-1] "\t" terms[NR]
    if (NR >= 3) print terms[NR-2] "\t" terms[NR-1] "\t" terms[NR]
  }
'
