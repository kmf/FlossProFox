#!/usr/bin/env perl

use Digest::SHA1;

$sha = Digest::SHA1->new;

$version = $ARGV[1];
$appname = $ARGV[0] . "-" . $version . ".xpi";
open(FILE, $appname);

$sha->addfile(*FILE);
$digest = $sha->hexdigest;

open(SRC, "update.rdf");
open(DST, "> IdenticaNotifier.rdf");

while (<SRC>) {
    s/\$VERSION\$/$version/;
    s/\$UPDATE_HASH\$/$digest/;
    print DST $_
}

