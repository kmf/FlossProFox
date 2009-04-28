#!/usr/bin/env perl

use File::Copy;

$src = "chrome.manifest.base";
$dst = "chrome.manifest";

copy("chrome.manifest.base", "chrome.manifest") or die "Couldn't copy file $!";

open OUTPUT, "+>> chrome.manifest";
opendir DIR, "locale" or die "Couldn't open directory, $!";
while ($locale = readdir DIR) {
    next if $locale =~ /^\./;
    print "$locale\n";
    print OUTPUT "locale identicanotifier $locale locale/$locale/\n";
}
