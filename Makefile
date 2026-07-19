UUID := o-launcher@oliwebd.github.com
EXT_DIR := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SCHEMA_SRC := schemas/org.gnome.shell.extensions.o-launcher.gschema.xml

.PHONY: build install compile-schemas dev-install pack lint lint-fix format format-check clean

build:
	pnpm install
	pnpm run build
	@mkdir -p dist/schemas
	@cp $(SCHEMA_SRC) dist/schemas/
	@cp metadata.json stylesheet.css dist/
	@$(MAKE) compile-schemas

compile-schemas:
	glib-compile-schemas dist/schemas/

install: build
	@mkdir -p $(EXT_DIR)
	@cp -r dist/* $(EXT_DIR)/
	@echo "Installed to $(EXT_DIR)"
	@echo "Log out/in (Wayland) or Alt+F2 r Enter (X11), then:"
	@echo "  gnome-extensions enable $(UUID)"

dev-install: install
	gnome-extensions enable $(UUID)
	journalctl -f -o cat /usr/bin/gnome-shell

pack: build
	@cd dist && zip -r ../$(UUID).zip . -x '*.map'
	@echo "Packaged $(UUID).zip"

lint:
	pnpm run lint

lint-fix:
	pnpm run lint -- --fix

format:
	pnpm run format

format-check:
	pnpm run format:check

clean:
	rm -rf dist $(UUID).zip
