# Makefile pour le compilateur de mtl.
COMMON_OBJS=properties.o dumpbc.o log.o

COMP_OBJS=main_compiler.o

SIMU_SRC=main_simu.c linux_simu.c linux_simuaudio.c linux_simunet.c vmem.c vloader.c vlog.c vinterp.c vaudio.c vnet.c
SIMU_OBJS=$(SIMU_SRC:.c=.o)
PROGS=mtl_simu mtl_comp

# CXXFLAGS=-DVSIMU -g3 -m32 -Wno-write-strings -DUSE_GLUT
# CFLAGS=-m32 -DVSIMU -g3 -std=c99 -Wno-write-strings -D_DEFAULT_SOURCE -DUSE_GLUT
CXXFLAGS=-DVSIMU -g3 -m32 -Wno-write-strings
CFLAGS=-m32 -DVSIMU -g3 -std=c99 -Wno-write-strings -D_DEFAULT_SOURCE

CC=gcc
CXX=g++

all : mtl_simu mtl_comp

.PHONY : vcomp/libvcomp.a

vcomp/libvcomp.a :
	$(MAKE) -C vcomp libvcomp.a

mtl_comp : vcomp/libvcomp.a $(COMMON_OBJS) $(COMP_OBJS)
	g++  -m32 $^ -o $@ vcomp/libvcomp.a

mtl_simu : vcomp/libvcomp.a $(COMMON_OBJS) $(SIMU_OBJS)
	g++  -m32 $^ -o $@ vcomp/libvcomp.a
#	g++  -m32 $^ -o $@ vcomp/libvcomp.a -framework GLUT -framework OpenGL

clean :
	$(MAKE) -C vcomp clean
	rm -f $(COMMON_OBJS) $(COMP_OBJS) $(SIMU_OBJS) $(PROGS)
