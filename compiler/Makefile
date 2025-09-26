# Makefile pour le compilateur de mtl.
COMMON_OBJS=properties.o dumpbc.o log.o

all : mtl_simu mtl_comp

.PHONY : vcomp/libvcomp.a mtl_comp mtl_simu

vcomp/libvcomp.a :
	$(MAKE) -C vcomp libvcomp.a

mtl_comp :
	$(MAKE) -C mtl_comp

mtl_simu :
	$(MAKE) -C mtl_simu

clean :
	$(MAKE) -C vcomp clean
	$(MAKE) -C mtl_comp clean
	$(MAKE) -C mtl_simu clean
	rm -f $(COMMON_OBJS)
