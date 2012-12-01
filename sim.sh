#!/bin/bash

CURRENTDIR=$(dirname $0)
cd $CURRENTDIR

COMPILER="compiler/mtl_simu"

# compile the source for the simulator
./scripts/make_nominal.sh -D SIMU

[ $? -eq 0 ] || { echo "Could not make nominal.mtl" ;  }

"$COMPILER" --mac 0123456789ab --source "nominal.mtl"
