.DEFAULT_GOAL := help

.PHONY: compiler clean firmware

COMPILER="./compiler/mtl_comp/mtl_comp"
SIMULATOR="./compiler/mtl_simu/mtl_simu"
# init,vm,simunet,simuleds,simuaudio,simumotors,http_server
LOGS="init,vm,http_server"
HTTP_SERVER_PATH=vl
HTTP_SERVER_PORT=8081

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
	@$(SIMULATOR) --mac 0123456789ab --logs $(LOGS) --source "nominal.mtl" --http_server_path $(HTTP_SERVER_PATH) --http_server_port $(HTTP_SERVER_PORT) || true
	@rm -f nominal.mtl foo.bin
