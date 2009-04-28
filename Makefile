APP_NAME=FlossProFox

XPIDL=~/applications/xulrunner-sdk/bin/xpidl
XPIDL_INCLUDE=~/applications/xulrunner-sdk/idl

TARGET = \
	components/nsIIdentiFoxDatabase.xpt      \
	components/nsIIdentiFoxHttpRequest.xpt   \
	components/nsIIdenticaNotifier.xpt

VERSION = $(shell cat install.rdf | perl ./tools/getver.pl)

BUILD_FILES = $(APP_NAME)* IdenticaNotifier.rdf .htaccess

all: $(TARGET)

components/%.xpt : components/%.idl
	$(XPIDL) -m typelib -w -v -I $(XPIDL_INCLUDE)  -I ./components -e $@ $<
	rm -f $(MOZILLA_PROFILE_PATH)/compreg.dat
	rm -f $(MOZILLA_PROFILE_PATH)/xpti.dat

build: test
	mv components/nsIdenticaNotifier.js tmp.js 
	perl -p -e 's/\$$VERSION\$$/$(VERSION)/' tmp.js >components/nsIdenticaNotifier.js 
	find . -name ".DS_Store" -exec rm -f {} \;
	perl ./tools/make_manifest.pl
	sh ./build.sh
	perl -p -e 's/\$$VERSION\$$/$(VERSION)/' meta.xml > $(APP_NAME).xml
	perl -p -e 's/\$$VERSION\$$/$(VERSION)/' htaccess > .htaccess

	mv $(APP_NAME).xpi $(APP_NAME)-$(VERSION).xpi
	mv tmp.js components/nsIdenticaNotifier.js
	perl ./tools/makehash.pl $(APP_NAME) $(VERSION)

test:
	@perl ./tools/check_locale.pl

update_version:
	scp $(BUILD_FILES) www.copiesofcopies.org:copiesofcopies.org/www/identica/

upload: build
	scp $(APP_NAME)-$(VERSION).xpi www.copiesofcopies.org:copiesofcopies.org/www/identica/
	echo "http://copiesofcopies.org/identica/$(APP_NAME)-$(VERSION).xpi"

clean:
	rm -f $(BUILD_FILES)
