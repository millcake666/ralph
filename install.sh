#!/usr/bin/env bash
# Ralph installer - cross-platform
# Usage: curl -sL https://raw.githubusercontent.com/millcake666/ralph/main/install.sh | sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REPO="millcake666/ralph"
LATEST_RELEASE_URL="https://github.com/${REPO}/releases/latest"
NPM_PACKAGE="@iannuttall/ralph"

# Detect OS and architecture
detect_os() {
  local os
  case "$(uname -s)" in
    Linux*)  os="linux" ;;
    Darwin*) os="macos" ;;
    *)       os="unknown" ;;
  esac
  echo "$os"
}

detect_arch() {
  local arch
  case "$(uname -m)" in
    x86_64)  arch="x64" ;;
    arm64)   arch="arm64" ;;
    aarch64) arch="arm64" ;;
    *)       arch="unknown" ;;
  esac
  echo "$arch"
}

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check for npm
check_npm() {
  if command_exists npm; then
    return 0
  else
    echo -e "${YELLOW}npm not found. Installing via npm is recommended.${NC}"
    return 1
  fi
}

# Install via npm
install_via_npm() {
  echo -e "${GREEN}Installing Ralph via npm...${NC}"
  
  # Check for global install
  if npm list -g "$NPM_PACKAGE" >/dev/null 2>&1; then
    echo -e "${YELLOW}Ralph is already installed globally. Updating...${NC}"
    npm update -g "$NPM_PACKAGE"
  else
    npm install -g "$NPM_PACKAGE"
  fi
  
  echo -e "${GREEN}✓ Installation complete!${NC}"
}

# Install from GitHub releases (binary)
install_from_github() {
  local os arch install_dir binary_url
  
  os=$(detect_os)
  arch=$(detect_arch)
  
  if [ "$os" = "unknown" ] || [ "$arch" = "unknown" ]; then
    echo -e "${RED}Unsupported platform: $(uname -s) $(uname -m)${NC}"
    echo -e "${YELLOW}Falling back to npm installation...${NC}"
    install_via_npm
    return
  fi
  
  # Determine install directory
  if [ "$EUID" -eq 0 ]; then
    install_dir="/usr/local/bin"
  else
    # Try to find a user-writable bin directory
    if [ -d "$HOME/.local/bin" ]; then
      install_dir="$HOME/.local/bin"
    elif [ -d "$HOME/bin" ]; then
      install_dir="$HOME/bin"
    else
      install_dir="$HOME/.local/bin"
      mkdir -p "$install_dir"
    fi
    
    # Add to PATH if not already there
    if [[ ":$PATH:" != *":$install_dir:"* ]]; then
      echo -e "${YELLOW}Note: Add $install_dir to your PATH:${NC}"
      echo "  export PATH=\"$install_dir:\$PATH\""
      echo "  # Add this to your ~/.bashrc, ~/.zshrc, or ~/.profile"
    fi
  fi
  
  # Try to download binary from GitHub releases
  # For now, we'll install from source since binaries aren't built yet
  echo -e "${YELLOW}Binary releases not yet available for $os-$arch${NC}"
  echo -e "${YELLOW}Falling back to npm installation...${NC}"
  install_via_npm
}

# Main installation logic
main() {
  echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║       Ralph Installer                  ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
  echo ""
  
  # Check for existing installation
  if command_exists ralph; then
    local current_version
    current_version=$(ralph --version 2>/dev/null || echo "unknown")
    echo -e "${YELLOW}Ralph is already installed (version: $current_version)${NC}"
    echo -e "${YELLOW}This will update to the latest version.${NC}"
    echo ""
  fi
  
  # Prefer npm installation for now
  if check_npm; then
    install_via_npm
  else
    echo -e "${RED}npm is required but not installed.${NC}"
    echo ""
    echo "Please install Node.js and npm first:"
    echo "  - macOS: brew install node"
    echo "  - Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  - Other: https://nodejs.org/"
    exit 1
  fi
  
  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║       Installation Complete!           ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${GREEN}Quick start:${NC}"
  echo "  ralph prd     # Generate a PRD"
  echo "  ralph build   # Run build loop"
  echo "  ralph help    # Show all commands"
  echo ""
  echo -e "${GREEN}Documentation: https://github.com/${REPO}#${NC}"
}

# Run installer
main "$@"
