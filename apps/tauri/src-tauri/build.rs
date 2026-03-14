fn main() {
  ensure_default_icon_png();
  ensure_default_icon_ico();
  tauri_build::build()
}

const ICON_PNG: &[u8] = &[
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0,
    1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 96, 96,
    96, 248, 15, 0, 1, 4, 1, 0, 95, 229, 195, 75, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96,
    130,
];

fn ensure_default_icon_png() {
  let path = std::path::Path::new("icons/icon.png");
  if path.is_file() {
    return;
  }
  if let Some(parent) = path.parent() {
    let _ = std::fs::create_dir_all(parent);
  }
  let _ = std::fs::write(path, ICON_PNG);
}

fn ensure_default_icon_ico() {
  let path = std::path::Path::new("icons/icon.ico");
  if path.is_file() {
    return;
  }
  if let Some(parent) = path.parent() {
    let _ = std::fs::create_dir_all(parent);
  }

  // Minimal ICO containing a single 1x1 32-bit PNG image.
  // This avoids requiring external tooling during builds (especially on Windows).
  let png_len = ICON_PNG.len() as u32;
  let mut ico = Vec::with_capacity(22 + ICON_PNG.len());
  // ICONDIR
  ico.extend_from_slice(&0u16.to_le_bytes()); // reserved
  ico.extend_from_slice(&1u16.to_le_bytes()); // type (1 = icon)
  ico.extend_from_slice(&1u16.to_le_bytes()); // count
  // ICONDIRENTRY (16 bytes)
  ico.push(1); // width
  ico.push(1); // height
  ico.push(0); // color count
  ico.push(0); // reserved
  ico.extend_from_slice(&1u16.to_le_bytes()); // planes
  ico.extend_from_slice(&32u16.to_le_bytes()); // bit count
  ico.extend_from_slice(&png_len.to_le_bytes()); // bytes in resource
  ico.extend_from_slice(&(22u32).to_le_bytes()); // image offset
  // Image data (PNG)
  ico.extend_from_slice(ICON_PNG);
  let _ = std::fs::write(path, ico);
}
