#!/bin/bash

CURRENTDIR=$(dirname $0)
cd $CURRENTDIR

COMPILER="compiler/mtl_comp"

./scripts/make_nominal.sh

[ $? -eq 0 ] || { echo "Could not make nominal.mtl" ;  }

"$COMPILER" -s "nominal.mtl" "bootcode.bin"
rm nominal.mtl
cp bootcode.bin vl/bc.jsp
echo "Firmware copied to $PWD/vl/bc.jsp"
