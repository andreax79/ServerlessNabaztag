CXXFLAGS=-m32 -Wno-write-strings -MMD -MP
CFLAGS=-m32 -Wno-write-strings -MMD -MP

OBJS = \
	bootstrap.o \
	compiler_file.o \
	compiler.o \
	compiler_prog.o \
	compiler_term.o \
	compiler_type.o \
	compiler_var.o \
	file.o \
	interpreter.o \
	memory.o \
	parser.o \
	parser_xml.o \
	prodbuffer.o \
	stdlib_core.o \
	terminal.o \
	util.o

DEPS = $(OBJS:.o=.d)

libvcomp.a : $(OBJS)
	ar rcs $@ $(OBJS)
	ranlib $@

clean :
	rm -f $(OBJS) $(DEPS) libvcomp.a

-include $(DEPS)
