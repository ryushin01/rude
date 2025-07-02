# 1. Flutter 프로젝트 루트에서

flutter clean

flutter pub get

  

# 2. ios 폴더로 이동

cd ios

  

# 3. 기존 iOS 빌드 관련 파일 삭제

rm -rf Podfile.lock Pods

  

# 4. CocoaPods 저장소 업데이트와 함께 다시 설치

pod install --repo-update