#!/bin/perl

while (<STDIN>) {
  if (/<em:version>([\d\.a-z]+)<\/em:version>\"*/) {
    print $1;
  }
}
