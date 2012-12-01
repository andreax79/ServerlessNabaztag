#!/usr/bin/perl -w

use strict;

my %defines;
my %includedFiles;

my @linesnums;
my $fileLevel = 0;

# process one file
sub processThisFile
{
		my $ifdefLevel=0;
		my $F = $_[0];
		my $filename = $_[1];
		my @ifdefskip;
		my $linenum;
		my $skippedLastLine=0;

		$fileLevel++;
		$ifdefskip[$ifdefLevel] = 0;

		while (my $line = <$F>) {
				$linenum++;
				if ($line =~ m/^#ifdef ([a-zA-Z0-9_-]+)/) {
						$ifdefLevel++;
						$ifdefskip[$ifdefLevel] = (! exists $defines{$1});
				}
				elsif ($line =~ m/^#else/) {
						if ($ifdefLevel > 0) {
								$ifdefskip[$ifdefLevel] = !($ifdefskip[$ifdefLevel]);
						}
						else {
								die "#else without matching #ifdef";
						}
				}
				elsif ($line =~ m/^#endif/) {
						if ($ifdefLevel > 0) {
								$ifdefLevel--;
						}
						else {
								die "#endif without matching #ifdef";
						}
				}
				else
				{
						if (0 != $ifdefskip[$ifdefLevel]) {
								$skippedLastLine=1;
								next ; # skip the line
						}
						if (1==$skippedLastLine) {
								print "// file: $filename, line $linenum\n";
						}
						$skippedLastLine=0;
						if ($line =~ m/^#define ([a-zA-Z0-9_-]+)/) {
								$defines{$1} = 1;
						}
						elsif ($line =~ m/^#include ([a-zA-Z0-9._-]+)/) {
								my $includedFile=$1;
								if (exists $includedFiles{$includedFile})
								{
										print "// file $includedFile already included\n";
										next ;
								}
								print "// file $includedFile //\n";
								my $includedFileHandle;
								open($includedFileHandle, $includedFile) || die "Could not open file $includedFile" ;
								$includedFiles{$includedFile} = 1;
								my $ret = processThisFile($includedFileHandle, $includedFile);
								close($includedFileHandle);
								if (0 != $ret) {
										print "Could not include file $includedFile";
										exit 1 ;
								}
								print "// end of file $includedFile //\n";
								print "// back to file $filename, line $linenum\n";
						}
						else {
								print "$line";
						}
				}
		}
		
		$fileLevel--;

		return ($ifdefLevel != 0) ;
}


# process main file
my $mainFileHandle;
my $filename;
my $state;
my $arg;

$filename = "STDIN";
$mainFileHandle = *STDIN ;

$state = 0;
foreach $arg (@ARGV) {
	if($arg eq "-D") {
		$state = 1;
	} else {
		if($state == 1) {
			$state = 0;
			$defines{$arg} = 1;
		} else {
			$filename = $arg;
		}
	}
}
unless ($filename eq "STDIN") {
		open($mainFileHandle, $filename);
		$includedFiles{$filename} = 1;
}

processThisFile($mainFileHandle, $filename);

close($mainFileHandle);
