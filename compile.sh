#!/bin/bash

CURRENTDIR=$(dirname $0)
cd $CURRENTDIR

COMPILER="compiler/mtl_comp"

./scripts/make_nominal.sh

[ $? -eq 0 ] || { echo "Could not make nominal.mtl" ;  }

"$COMPILER" -s "nominal.mtl" "bootcode.bin"
rm nominal.mtl
cp bootcode.bin web/vl/bc.jsp
echo "Firmware copyed to $PWD/web/vl/bc.jsp"