// ===== 그림에서 얼굴 찾기 (Apple Vision) =====
//
// tools/make-glossary-images.py 가 부른다. 그림마다 한 줄씩 JSON 을 낸다.
//   {"file": 경로, "faces": [[x, y, w, h, 확신도], …], "attention": [[x, y, w, h], …]}
// 좌표는 왼쪽 위가 원점인 0~1 비율이다 (Vision 은 왼쪽 아래가 원점이라 뒤집는다).
//
// 사람 얼굴로 배운 감지기라 사람 그림(로미·레나·몬쥬 박사, 변신한 프린세스)은 잘 찾지만
// 티니핑 얼굴은 하나도 찾지 못한다(12마리를 넣어 보았다). 낱말 풀이에 티니핑 그림이 없어 괜찮다.
// attention 은 눈길이 가는 곳(대개 인물 전체)으로, 얼굴을 못 찾았을 때 쓴다.
//
// 맥에서만 돈다:  swift tools/face-box.swift <그림>...
import CoreImage
import Foundation
import Vision

func box(_ r: CGRect) -> [Double] {
  [Double(r.minX), Double(1 - r.maxY), Double(r.width), Double(r.height)]
    .map { ($0 * 1000).rounded() / 1000 }
}

for path in CommandLine.arguments.dropFirst() {
  var out: [String: Any] = ["file": path, "faces": [], "attention": []]
  if let image = CIImage(contentsOf: URL(fileURLWithPath: path)) {
    let faces = VNDetectFaceRectanglesRequest()
    let attention = VNGenerateAttentionBasedSaliencyImageRequest()
    if (try? VNImageRequestHandler(ciImage: image, options: [:]).perform([faces, attention])) != nil {
      out["faces"] = (faces.results ?? []).map { box($0.boundingBox) + [Double($0.confidence)] }
      out["attention"] = ((attention.results?.first as? VNSaliencyImageObservation)?.salientObjects ?? [])
        .map { box($0.boundingBox) }
    }
  }
  let data = try! JSONSerialization.data(withJSONObject: out, options: [.sortedKeys])
  print(String(data: data, encoding: .utf8)!)
}
