import Foundation
import Capacitor
import Vision
import UIKit

@objc(VisionPlugin)
public class VisionPlugin: CAPPlugin {

    /// Runs VNClassifyImageRequest + VNRecognizeTextRequest on the given
    /// base64-encoded image. Returns { labels: [String], text: [String] }.
    @objc func analyzeImage(_ call: CAPPluginCall) {
        guard let base64 = call.getString("imageBase64"),
              let data   = Data(base64Encoded: base64, options: .ignoreUnknownCharacters),
              let image  = UIImage(data: data),
              let cgImage = image.cgImage else {
            call.resolve(["labels": [], "text": []])
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            var labels: [String] = []
            var texts:  [String] = []

            let group = DispatchGroup()

            // ── Classification ────────────────────────────────────────────────
            group.enter()
            let classifyRequest = VNClassifyImageRequest { request, _ in
                defer { group.leave() }
                guard let observations = request.results as? [VNClassificationObservation] else { return }
                labels = observations
                    .filter { $0.confidence >= 0.3 }
                    .map    { $0.identifier }
            }

            // ── Text recognition ──────────────────────────────────────────────
            group.enter()
            let textRequest = VNRecognizeTextRequest { request, _ in
                defer { group.leave() }
                guard let observations = request.results as? [VNRecognizedTextObservation] else { return }
                texts = observations.compactMap { $0.topCandidates(1).first?.string }
            }
            textRequest.recognitionLevel = .accurate

            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            try? handler.perform([classifyRequest, textRequest])

            group.wait()
            call.resolve(["labels": labels, "text": texts])
        }
    }
}
