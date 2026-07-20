# Makefile pour le compilateur de mtl_simu.
COMMON_OBJS = ../properties.o ../dumpbc.o ../log.o
COMMON_DEPS = $(COMMON_OBJS:.o=.d)
SIMU_SRC = main_simu.c linux_simu.c linux_simuaudio.c linux_simunet.c vmem.c vloader.c vlog.c vinterp.c vaudio.c vnet.c http_server.c
SIMU_OBJS = $(SIMU_SRC:.c=.o)
SIMU_DEPS = $(SIMU_OBJS:.o=.d)
VCOMP_LIB = ../vcomp/libvcomp.a

# Enable OpenGL with "make USE_OPENGL=1"
PROGS = mtl_simu
USE_OPENGL ?= 0

ifeq ($(USE_OPENGL),1)
	# OpenGL version
	UNAME_S := $(shell uname -s)
	CXXFLAGS = -DVSIMU -g3 -m32 -Wno-write-strings -DUSE_GLUT -MMD -MP
	CFLAGS = -m32 -DVSIMU -g3 -std=c99 -Wno-write-strings -D_DEFAULT_SOURCE -DUSE_GLUT -MMD -MP

    ifeq ($(UNAME_S),Darwin)  # mac
        OPENGL_LIBS = -framework GLUT -framework OpenGL
    else ifeq ($(UNAME_S),Linux)
        OPENGL_LIBS = -lglut -lGLU -lGL
    endif
else
	# Non-OpenGL version
	CXXFLAGS = -DVSIMU -g3 -m32 -Wno-write-strings -MMD -MP
	CFLAGS = -m32 -DVSIMU -g3 -std=c99 -Wno-write-strings -D_DEFAULT_SOURCE -MMD -MP
endif

CC = gcc
CXX = g++

all : mtl_simu

$(VCOMP_LIB) :
	$(MAKE) -C ../vcomp libvcomp.a

mtl_simu : $(VCOMP_LIB) $(COMMON_OBJS) $(SIMU_OBJS)
	$(CXX) -m32 $^ -o $@ $(VCOMP_LIB) $(OPENGL_LIBS)

clean :
	rm -f $(SIMU_OBJS) $(SIMU_DEPS) $(PROGS)

-include $(COMMON_DEPS)
-include $(SIMU_DEPS)
