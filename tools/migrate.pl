#!/usr/bin/env perl

use strict;
use File::Copy;

sub readentities
{
    my $locale = shift;
    my $filename = shift;

    my @entities;
    open FILE, "locale/$locale/$filename" or die "Couldn't open $filename, $!";


    while (<FILE>) {
	chomp;
	my $line = $_;
	if ($filename =~ /properties$/) {
	    my @entity = split(/=/, $line);
	    push @entities, $entity[0];
	}
	else {
	    $line =~ /ENTITY identicanotifier\.(\w+)\s*/;
	    push @entities, $1;
	}
    }	
    close FILE;
    @entities;
}

my @locales;

opendir LOCALE_DIR, "locale" or die "Couldn't open directory, $!";
while (my $locale = readdir LOCALE_DIR) {
    next if $locale =~ /^\./;
    next if $locale eq 'en-US';
    push @locales, $locale;
}

my $target = 'identicanotifier.pref.dtd';

my @entities = readentities('en-US', $target);

foreach my $locale (@locales) {

    copy("locale/$locale/$target", "locale/$locale/$target.orig");
    
    open INPUT, "locale/$locale/$target.orig" or die "Couldn't open file, $!";
    open OUTPUT, "> locale/$locale/$target" or die "Couldn't open file, $!";

    while (<INPUT>) {
	chomp;
	my $line = $_;

        my @entity;
	if ($target =~ /properties$/) {
	    @entity = split(/=/, $line);
	}
	else {
	    $line =~ /ENTITY identicanotifier\.(\w+)\s*/;
	    push @entity, $1;
	}

	if (grep(/$entity[0]/, @entities)) {
	    print OUTPUT "$line\n";
	}
    }
    close OUTPUT;
    close INPUT;
}

