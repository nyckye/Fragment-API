// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FragmentStarsBot",
    platforms: [
        .macOS(.v13),
        .iOS(.v16)
    ],
    dependencies: [
        .package(url: "https://github.com/Alamofire/Alamofire.git", from: "5.8.0"),
        .package(url: "https://github.com/jedisct1/swift-sodium.git", from: "0.9.1")
    ],
    targets: [
        .executableTarget(
            name: "FragmentStarsBot",
            dependencies: [
                "Alamofire",
                .product(name: "Sodium", package: "swift-sodium")
            ],
            path: "Sources"
        )
    ]
)
