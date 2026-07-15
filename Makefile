-include .env

.DEFAULT_GOAL := help

.PHONY: compiler clean firmware

COMPILER="./compiler/mtl_comp/mtl_comp"
SIMULATOR="./compiler/mtl_simu/mtl_simu"
# init,vm,simunet,simuleds,simuaudio,simumotors,http_server
LOGS="init,vm,http_server"
HTTP_SERVER_PATH=vl
HTTP_SERVER_PORT=8081
MAC?=0123456789ab

help:
	@echo "- make compiler     Build the compiler and the simulator"
	@echo "- make firmware     Build the firmware"
	@echo "- make deploy       Build and deploy the firmware to the target server"
	@echo "- make run-sim      Run the simulator"
	@echo "- make clean        Cleanup"
	@echo "- make test         Run the tests"

.PHONY: compiler
compiler:
	@$(MAKE) -C compiler

.PHONY: clean
clean:
	@$(MAKE) -C compiler clean

.PHONY: words
words:
	@./scripts/extract_words.py firmware/forth/*.mtl vl/*.forth > vl/words.txt

.PHONY: firmware
firmware: words
	@./scripts/make_nominal.sh
	@$(COMPILER) -s "nominal.mtl" "bootcode.bin"
	@rm -f nominal.mtl
	@cp bootcode.bin vl/bc.jsp
	@echo "Firmware copied to $$PWD/vl/bc.jsp"

.PHONY: deploy
deploy: firmware
	@if [ -z "$(DEPLOY_TARGET)" ]; then \
		echo "Please set the DEPLOY_TARGET variable in .env file"; \
		exit 1; \
	fi
	scp vl/bc.jsp vl/*.forth vl/*.json vl/index.html vl/words.txt $(DEPLOY_TARGET)
	scp vl/api/openapi.yaml $(DEPLOY_TARGET)/api/openapi.yaml

.PHONY: run-sim
run-sim:
	@./scripts/make_nominal.sh -D SIMU
	@$(SIMULATOR) --mac $(MAC) --logs $(LOGS) --source "nominal.mtl" --http_server_path $(HTTP_SERVER_PATH) --http_server_port $(HTTP_SERVER_PORT) || true
	@rm -f nominal.mtl foo.bin

.PHONY: test
test:
	@./scripts/make_nominal.sh -D SIMU -D TEST
	@$(SIMULATOR) --noleds --mac $(MAC) --logs vm --source "nominal.mtl" --http_server_path $(HTTP_SERVER_PATH) --http_server_port $(HTTP_SERVER_PORT) || true
	@rm -f nominal.mtl foo.bin
