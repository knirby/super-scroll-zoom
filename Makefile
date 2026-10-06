UUID := super-scroll-zoom@knirby.github.io
ZIP := $(UUID).shell-extension.zip

.PHONY: pack install uninstall clean

pack: $(ZIP)

$(ZIP): metadata.json extension.js prefs.js schemas/*.gschema.xml
	gnome-extensions pack --force .

install: $(ZIP)
	gnome-extensions install --force $(ZIP)
	@echo "Installed. Log out and back in, then: gnome-extensions enable $(UUID)"

uninstall:
	gnome-extensions uninstall $(UUID)

clean:
	rm -f $(ZIP) schemas/gschemas.compiled
