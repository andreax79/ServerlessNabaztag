# Makefile pour le compilateur de mtl_comp.
COMMON_OBJS = ../properties.o ../dumpbc.o ../log.o
COMMON_DEPS = $(COMMON_OBJS:.o=.d)
COMP_OBJS = main_compiler.o
COMP_DEPS = $(COMP_OBJS:.o=.d)
VCOMP_LIB = ../vcomp/libvcomp.a

PROGS = mtl_comp

CXXFLAGS = -DVSIMU -g3 -m32 -Wno-write-strings -MMD -MP
CFLAGS = -m32 -DVSIMU -g3 -std=c99 -Wno-write-strings -D_DEFAULT_SOURCE -MMD -MP

CC = gcc
CXX = g++

all : mtl_comp

$(VCOMP_LIB) :
	$(MAKE) -C ../vcomp libvcomp.a

mtl_comp: $(VCOMP_LIB) $(COMMON_OBJS) $(COMP_OBJS)
	$(CXX) -m32 $^ -o $@ $(VCOMP_LIB)

clean:
	rm -f $(COMP_OBJS) $(COMP_DEPS) $(PROGS)

-include $(COMMON_DEPS)
-include $(COMP_DEPS)
