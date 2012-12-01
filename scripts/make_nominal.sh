#!/bin/bash

CURRENTDIR=$(dirname $0)
cd $CURRENTDIR/../firmware/

PREPROC="../scripts/preproc.pl"
PREPROC2="../scripts/preproc_remove_extra_protos.pl"

"$PREPROC" $* < main.mtl | "$PREPROC2" > "../nominal.mtl"
