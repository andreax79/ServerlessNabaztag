.DEFAULT_GOAL := help

.PHONY: compiler clean firmware

COMPILER="./compiler/mtl_comp/mtl_comp"
SIMULATOR="./compiler/mtl_simu/mtl_simu"

help:
	@echo "- make compiler     Build the compiler and the simulator"
	@echo "- make firmware     Build the firmware"
	@echo "- make run-sim      Run the simulator"
	@echo "- make clean        Cleanup"

compiler:
	@$(MAKE) -C compiler

clean:
	@$(MAKE) -C compiler clean

firmware:
	@./scripts/make_nominal.sh
	@$(COMPILER) -s "nominal.mtl" "bootcode.bin"
	@rm -f nominal.mtl
	@cp bootcode.bin vl/bc.jsp
	@echo "Firmware copied to $$PWD/vl/bc.jsp"

run-sim:
	@./scripts/make_nominal.sh -D SIMU
	@$(SIMULATOR) --mac 0123456789ab --source "nominal.mtl" || true
	@rm -f nominal.mtl foo.bin
