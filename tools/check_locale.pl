#!/usr/bin/env perl

use strict;

my $err = 0;

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
	    $line =~ /ENTITY identicanotifier\.([^ ]+) */;
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

opendir EN_US, "locale/en-US/" or die "Couldn't open directory, $!";
while (my $file = readdir EN_US) {
    next if $file =~ /^\./;

    my @entities = readentities('en-US', $file);

    foreach my $locale (@locales) {
	eval {
	    my @localized = readentities($locale, $file);
	    foreach my $entity (@entities) {
		unless (grep(/$entity/, @localized)) {
		    print "$locale/$file doesn't have entity '$entity'\n";
		    $err = 1;
		}
	    }
	    foreach my $entity (@localized) {
		unless (grep(/$entity/, @entities)) {
		    print "$locale/$file have unnecessary entity '$entity'\n";
		    $err = 1;
		}
	    }
	};
	if (my $err = $@) {
	    print $err;
	}
    }
}

exit $err;

