# Super Scroll Zoom

Hold **Super** and scroll to zoom the whole screen, anywhere, in GNOME Shell 50 and 51. :3

- Scroll up or down to zoom in or out. It's smooth and follows the pointer.
- **Super+0** goes back to normal.
- A small popup shows the zoom level.

The step, the maximum zoom, how the view follows the pointer, the popup and the shortcut are all set in the extension's settings. It uses GNOME's built-in magnifier.

## Install

```sh
git clone https://github.com/knirby/super-scroll-zoom.git
cd super-scroll-zoom
make install
```

Log out and back in, then run `gnome-extensions enable super-scroll-zoom@knirby.github.io`. `make uninstall` removes it.

Zooming uses the window-drag key, which is Super by default. If you've changed that key, the settings show a button to set it back.

## License

BSD-3-Clause; see [LICENSE](LICENSE). Contributors follow the [GNOME Code of Conduct](CODE_OF_CONDUCT.md).
