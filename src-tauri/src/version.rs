/// 语义化版本比较
/// 返回: -1 (a < b), 0 (a == b), 1 (a > b)
pub fn compare_versions(a: &str, b: &str) -> i32 {
    let parse = |v: &str| -> Vec<u32> {
        v.trim_start_matches('v')
            .split('.')
            .filter_map(|s| s.trim().parse::<u32>().ok())
            .collect()
    };

    let va = parse(a);
    let vb = parse(b);

    for i in 0..va.len().max(vb.len()) {
        let na = va.get(i).unwrap_or(&0);
        let nb = vb.get(i).unwrap_or(&0);
        if na < nb { return -1; }
        if na > nb { return 1; }
    }
    0
}

/// 检查主程序版本是否满足插件的 minHostVersion
/// true = 兼容, false = 需要更新主程序
pub fn is_host_compatible(host_version: &str, min_host_version: &str) -> bool {
    if min_host_version.is_empty() { return true; }
    compare_versions(host_version, min_host_version) >= 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compare() {
        assert_eq!(compare_versions("1.0.0", "1.0.0"), 0);
        assert_eq!(compare_versions("1.0.1", "1.0.0"), 1);
        assert_eq!(compare_versions("0.9.9", "1.0.0"), -1);
        assert_eq!(compare_versions("v0.1.0", "0.1.0"), 0);
        assert_eq!(compare_versions("0.2", "0.1.0"), 1);
    }

    #[test]
    fn test_compatible() {
        assert!(is_host_compatible("0.1.0", "0.1.0"));
        assert!(is_host_compatible("0.2.0", "0.1.0"));
        assert!(!is_host_compatible("0.1.0", "0.2.0"));
        assert!(is_host_compatible("0.1.0", ""));
    }
}
