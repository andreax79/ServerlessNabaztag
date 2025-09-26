# Makefile pour le compilateur de mtl_comp.
COMMON_OBJS = ../properties.o ../dumpbc.o ../log.o
COMP_OBJS = main_compiler.o
VCOMP_LIB = ../vcomp/libvcomp.a

PROGS = mtl_comp

CXXFLAGS = -DVSIMU -g3 -m32 -Wno-write-strings
CFLAGS = -m32 -DVSIMU -g3 -std=c99 -Wno-write-strings -D_DEFAULT_SOURCE

CC = gcc
CXX = g++

all : mtl_comp

$(VCOMP_LIB) :
	$(MAKE) -C ../vcomp libvcomp.a

mtl_comp: $(VCOMP_LIB) $(COMMON_OBJS) $(COMP_OBJS)
	$(CXX) -m32 $^ -o $@ $(VCOMP_LIB)

clean:
	rm -f $(COMP_OBJS) $(PROGS)
