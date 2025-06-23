# Network Share Automount GNOME Shell Extension Makefile

# Extension metadata
UUID = network-share-automount@gavindi.github.com
EXTENSION_NAME = network-share-automount

# Directories
SRC_DIR = .
BUILD_DIR = build
SCHEMAS_DIR = schemas
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SYSTEM_SCHEMAS_DIR = /usr/share/glib-2.0/schemas

# Files to include in the extension
EXTENSION_FILES = \
	extension.js \
	prefs.js \
	metadata.json

SCHEMA_FILES = \
	$(SCHEMAS_DIR)/org.gnome.shell.extensions.network-share-automount.gschema.xml

# Default target
all: build
	@echo "Use 'make install' to install the extension."

# Build the extension (compile schemas)
build:
	@echo "Building extension..."
	# Create build directory
	mkdir -p $(BUILD_DIR)
	# Copy extension files
	cp $(EXTENSION_FILES) $(BUILD_DIR)/
	# Copy and compile schema
	mkdir -p $(BUILD_DIR)/$(SCHEMAS_DIR)
	cp $(SCHEMA_FILES) $(BUILD_DIR)/$(SCHEMAS_DIR)/
	glib-compile-schemas $(BUILD_DIR)/$(SCHEMAS_DIR)/
	@echo "Build complete!"

# Install extension to user directory
install: build
	@echo "Installing extension to $(INSTALL_DIR)..."
	# Remove existing installation
	rm -rf $(INSTALL_DIR)
	# Create installation directory
	mkdir -p $(INSTALL_DIR)
	# Copy all built files
	cp $(EXTENSION_FILES) $(INSTALL_DIR)/
	# Install schema to extension directory
	mkdir -p $(INSTALL_DIR)/schemas
	cp $(SCHEMA_FILES) $(INSTALL_DIR)/schemas/
	glib-compile-schemas $(INSTALL_DIR)/schemas/
	@echo ""
	@echo "Extension installed successfully!"
	@echo "Please restart GNOME Shell:"
	@echo "  - On X11: Press Alt+F2, type 'r', press Enter"
	@echo "  - On Wayland: Log out and log back in"
	@echo "Then enable the extension with:"
	@echo "  gnome-extensions enable $(UUID)"

# Install system-wide (requires sudo)
install-system: build
	@echo "Installing extension system-wide..."
	sudo mkdir -p /usr/share/gnome-shell/extensions/$(UUID)
	sudo cp -r $(BUILD_DIR)/* /usr/share/gnome-shell/extensions/$(UUID)/
	sudo cp $(SCHEMA_FILES) $(SYSTEM_SCHEMAS_DIR)/
	sudo glib-compile-schemas $(SYSTEM_SCHEMAS_DIR)/
	@echo "System-wide installation complete!"

# Uninstall from user directory
uninstall:
	@echo "Uninstalling extension..."
	# Disable extension first
	-gnome-extensions disable $(UUID)
	# Remove extension directory
	rm -rf $(INSTALL_DIR)
	@echo "Extension uninstalled!"

# Uninstall system-wide installation
uninstall-system:
	@echo "Uninstalling system-wide extension..."
	-gnome-extensions disable $(UUID)
	sudo rm -rf /usr/share/gnome-shell/extensions/$(UUID)
	sudo rm -f $(SYSTEM_SCHEMAS_DIR)/org.gnome.shell.extensions.network-share-automount.gschema.xml
	sudo glib-compile-schemas $(SYSTEM_SCHEMAS_DIR)/
	@echo "System-wide extension uninstalled!"

# Clean build artifacts
clean:
	@echo "Cleaning build directory..."
	rm -rf $(BUILD_DIR)
	@echo "Clean complete!"

# Create a distributable zip file
dist: build
	@echo "Creating distribution package..."
	cd $(BUILD_DIR) && zip -r ../$(EXTENSION_NAME)-v$(shell grep '"version"' metadata.json | cut -d: -f2 | tr -d ' ,' | head -1).zip .
	@echo "Distribution package created!"

# Enable the extension after installation
enable:
	@echo "Enabling extension..."
	gnome-extensions enable $(UUID)
	@echo "Extension enabled!"

# Disable the extension
disable:
	@echo "Disabling extension..."
	gnome-extensions disable $(UUID)
	@echo "Extension disabled!"

# Show extension status
status:
	@echo "Extension status:"
	@gnome-extensions list --enabled | grep -q $(UUID) && echo "Status: ENABLED" || echo "Status: DISABLED"
	@gnome-extensions list | grep -q $(UUID) && echo "Installed: YES" || echo "Installed: NO"

# Restart GNOME Shell (X11 only)
restart-shell:
	@echo "Restarting GNOME Shell (X11 only)..."
	@if [ "$$XDG_SESSION_TYPE" = "x11" ]; then \
		busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'Meta.restart("Restarting...")'; \
	else \
		echo "Wayland detected - please log out and log back in"; \
	fi

# Development workflow: reinstall and enable
dev: clean install enable
	@echo "Development installation complete!"

# Help target
help:
	@echo "Network Share Automount Extension Build System"
	@echo ""
	@echo "Available targets:"
	@echo "  build           - Build the extension (compile schemas)"
	@echo "  install         - Install to user directory (~/.local/share/gnome-shell/extensions/)"
	@echo "  install-system  - Install system-wide (requires sudo)"
	@echo "  uninstall       - Remove from user directory"
	@echo "  uninstall-system- Remove system-wide installation"
	@echo "  clean           - Remove build artifacts"
	@echo "  dist            - Create distributable zip file"
	@echo "  enable          - Enable the extension"
	@echo "  disable         - Disable the extension"
	@echo "  status          - Show extension status"
	@echo "  restart-shell   - Restart GNOME Shell (X11 only)"
	@echo "  dev             - Clean, install, and enable (development workflow)"
	@echo "  help            - Show this help message"
	@echo ""
	@echo "Quick start:"
	@echo "  make install    # Install the extension"
	@echo "  make enable     # Enable the extension"

# Declare phony targets
.PHONY: all build install install-system uninstall uninstall-system clean dist enable disable status restart-shell dev help