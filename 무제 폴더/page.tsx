"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Loading, Typography } from "@components";
import { Size } from "@components/Constants";
import { useDisclosure, useFetchApi } from "@hooks";
import { usePayInfoData } from "@libs";
import { caseDetailAtom, toastState } from "@stores";
import { getCompareWithToday } from "@utils/dateUtil";
import { phoneInquiry } from "@utils/flutterUtil";
import { useMutation } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import Cookies from "js-cookie";
import PayFail from "@app/my-case/PayFail";
import PayGroupItem from "@app/my-case/PayGroupItem";
import PaySuccess from "@app/my-case/PaySuccess";
import PayProceeding from "@app/my-case/PayProceeding";

type TIsSuccess = {
  seller: "" | "fail" | "success";
  buyer: "" | "fail" | "success";
};

export default function My_PR_006M() {
  const searchParams = useSearchParams();
  const { fetchApi } = useFetchApi();
  const { isOpen, open, close } = useDisclosure();
  const {
    isOpen: isOpen999Error,
    open: open999Error,
    close: close999Error,
  } = useDisclosure();
  const callToast = useSetAtom(toastState);
  const caseDetailData = sessionStorage.getItem("caseDetail");
  const { statCd } = useAtomValue(caseDetailAtom);
  const router = useRouter();
  const [failMsg, setFailMsg] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState<TIsSuccess>({
    seller: "",
    buyer: "",
  });

  // 2025.05.28 대체서류등록 후 플러터에서 돌아왔을때, loanNo(여신번호) 정보 누락으로 인해 쿠키에서 데이터 불러오기 추가
  const loanNo = Cookies.get("loanNo")!;
  const regType = Cookies.get("regType")!;

  const { seller, buyer, refetch, execDt, adminReqStatCd } = usePayInfoData({
    loanNo,
  });

  const errorCode = searchParams.get("code");

  // 대출금(차주/매도인) 지급 요청
  const {
    mutate: requestAllPayment,
    data,
    isPending,
  } = useMutation({
    mutationKey: ["request-all-payment", loanNo],
    mutationFn: () =>
      fetchApi({
        url: `${process.env.NEXT_PUBLIC_APP_WOORI_API_URL}/api/cntr/SlrDbtrPayReq?loanNo=${loanNo}`,
        method: "post",
      }).then((res) => res.json()),
    gcTime: 0,
    onSuccess: (res) => {
      if (res.code !== "00") {
        setIsSuccess({ seller: "fail", buyer: "fail" });

        // 응답 요청 지연 시
        if (res.data === "999") {
          open999Error();
        } else {
          setFailMsg(res.msg);
          open();
        }
      }

      // 상환 정보 조회
      // refetch();
    },
    onError: (error) => {
      console.log("error", error);
    },
  });

  // 차주 지급금 요청
  const { mutate: requestBuyerPayment, isPending: requestBuyerPending } =
    useMutation({
      mutationKey: ["request-buyer-payment"],
      mutationFn: () =>
        fetchApi({
          url: `${process.env.NEXT_PUBLIC_APP_WOORI_API_URL}/api/cntr/ByerPayReq?loanNo=${loanNo}`,
          method: "post",
        }).then((res) => res.json()),
      gcTime: 0,
      onSuccess: (res) => {
        if (res.code !== "00") {
          setIsSuccess({ seller: "", buyer: "fail" });

          // 응답 요청 지연 시
          if (res.data === "999") {
            open999Error();
          } else {
            setFailMsg(res.msg);
            open();
          }
        }

        // 상환 정보 조회
        // refetch();
      },
      onError: (error) => {
        console.log("error", error);
      },
    });

  // 매도인 지급금 요청
  const { mutate: requestSellerPayment, isPending: requestSellerPending } =
    useMutation({
      mutationKey: ["request-seller-payment"],
      mutationFn: () =>
        fetchApi({
          url: `${process.env.NEXT_PUBLIC_APP_WOORI_API_URL}/api/cntr/SlrPayReq?loanNo=${loanNo}`,
          method: "post",
        }).then((res) => res.json()),
      gcTime: 0,
      onSuccess: (res) => {
        if (res.code !== "00") {
          setIsSuccess({ seller: "fail", buyer: "" });

          // 응답 요청 지연 시
          if (res.data === "999") {
            open999Error();
          } else {
            setFailMsg(res.msg);
            open();
          }
        }

        // 상환 정보 조회
        // refetch();
      },
      onError: (error) => {
        console.log("error", error);
      },
    });

  const isAllPass = Object.values(isSuccess).every((el) => el === "success");
  const isAllFail = Object.values(isSuccess).every((el) => el === "fail");

  const makeIsProgressing = () => setIsSuccess({ seller: "", buyer: "" });

  useEffect(() => {
    if (statCd === "12" && loanNo !== "" && !isPending) {
      makeIsProgressing();
      requestAllPayment();
      return;
    }
  }, [statCd, loanNo]);

  useEffect(() => {
    setIsSuccess({
      seller:
        seller?.statCd === "02"
          ? "success"
          : seller?.statCd === "91" ||
            seller?.statCd === "92" ||
            seller?.statCd === "93" ||
            seller?.statCd === "94" ||
            seller?.statCd === "99" ||
            seller?.statCd.length === 3 //은행 오류 응답코드(3자리)일 경우 실패
          ? "fail"
          : "",
      buyer:
        buyer?.statCd === "02"
          ? "success"
          : buyer?.statCd === "91" ||
            buyer?.statCd === "92" ||
            buyer?.statCd === "93" ||
            buyer?.statCd === "94" ||
            buyer?.statCd === "99" ||
            buyer?.statCd.length === 3 //은행 오류 응답코드(3자리)일 경우 실패
          ? "fail"
          : "",
    });
  }, [seller, buyer]);

  // 서류 제출 승인 결과 UI 노출 조건: 서류 요청 중(00) 또는 서류 확인 중(01) 또는 서류 반려(02)
  const isDocumentUI =
    adminReqStatCd === "00" ||
    adminReqStatCd === "01" ||
    adminReqStatCd === "02";

  // /* 25.05.02 이전페이지에서 requestAllPayment로 페이지 이동 후 isSuccess 감지 하여 실패케이스가 한건이라도 있으면 오류 팝업 뜨게 */
  useEffect(() => {
    if (isSuccess.seller === "fail" || isSuccess.buyer === "fail") {
      if (isSuccess.seller === "fail") {
        setFailMsg(
          `[실패코드 : ${seller?.errCd}] 대출금을 다시 요청하기 위해\n 고객센터(1877-2495)로 문의해주세요.`
        );
      } else if (isSuccess.buyer === "fail") {
        setFailMsg(
          `[실패코드 : ${buyer?.errCd}] 대출금을 다시 요청하기 위해\n 고객센터(1877-2495)로 문의해주세요.`
        );
      }

      console.log(errorCode);

      if (!isDocumentUI) {
        if (errorCode === "999") {
          open999Error();
        } else if (errorCode === null) {
          return;
        } else {
          open();
        }
      }
    }
  }, [isSuccess]);

  // 대출실행일이 현재보다 과거이면 true, 같거나 미래이면 false
  const isPast = getCompareWithToday(execDt) === "past";

  console.log("isSuccess.seller", isSuccess.seller); // fail > ""
  console.log("isAllFail", isAllFail); // true > false

  return (
    <>
      {(requestSellerPending || requestBuyerPending || isPending) && (
        <Loading />
      )}
      <div className="flex flex-col justify-between grow w-full h-full">
        <div>
          <Typography
            type={Typography.TypographyType.H1}
            color="text-kos-gray-800"
          >
            {isDocumentUI
              ? `서류 제출 승인 결과를\n확인해 주세요`
              : `대출금 지급 결과를\n확인해 주세요`}
          </Typography>
          {
            <div className="flex justify-end py-2 mb-6">
              {!isAllPass && (
                // 25.05.19 다시 불러오기 버튼 임시 표시
                <Button.CtaButton
                  size="Small"
                  state="None"
                  onClick={() => refetch()}
                >
                  다시 불러오기
                </Button.CtaButton>
              )}
            </div>
          }
          <div className="w-full flex flex-col gap-y-3">
            {seller?.payAmt !== undefined && seller?.payAmt > 0 && (
              <PayGroupItem label="매도인" payAmt={seller?.payAmt}>
                {
                  !isDocumentUI &&
                    !isAllFail &&
                    (seller?.statCd === "01" ? (
                      <PayProceeding text="지급 요청 중" />
                    ) : seller?.statCd === "02" ? (
                      <PaySuccess />
                    ) : (
                      <div className="flex justify-between">
                        <PayFail errCd={seller?.errCd} />
                        <Button.CtaButton
                          size={Size.Small}
                          state={"Default"}
                          disabled={isPast}
                          onClick={() => {
                            makeIsProgressing();
                            requestSellerPayment();
                          }}
                        >
                          다시 요청하기
                        </Button.CtaButton>
                      </div>
                    ))

                  // (isSuccess.seller === "success" ? (
                  //   <PaySuccess />
                  // ) : isAllFail && isSuccess.seller === "fail" ? (
                  //   <div className="flex justify-between">
                  //     <PayFail errCd={seller?.errCd} />
                  //     <Button.CtaButton
                  //       size={Size.Small}
                  //       state={"Default"}
                  //       disabled={isPast}
                  //       onClick={() => {
                  //         makeIsProgressing();
                  //         requestSellerPayment();
                  //       }}
                  //     >
                  //       다시 요청하기
                  //     </Button.CtaButton>
                  //   </div>
                  // ) : (
                  //   <PayProceeding text="지급 요청 중" />
                  // ))

                  // (isSuccess.seller === "" ? (
                  //   // 25.05.19 지급 요청 중 문구 임시 표시
                  //   <PayProceeding text="지급 요청 중" />
                  // ) : (
                  //   !isAllFail &&
                  //   (isSuccess.seller === "success" ? (
                  //     <PaySuccess />
                  //   ) : (
                  //     <div className="flex justify-between">
                  //       <PayFail errCd={seller?.errCd} />
                  //       <Button.CtaButton
                  //         size={Size.Small}
                  //         state={"Default"}
                  //         disabled={isPast}
                  //         onClick={() => {
                  //           makeIsProgressing();
                  //           requestSellerPayment();
                  //         }}
                  //       >
                  //         다시 요청하기
                  //       </Button.CtaButton>
                  //     </div>
                  //   ))
                  // ))
                }
              </PayGroupItem>
            )}

            {!isDocumentUI &&
              // !isAllFail &&
              !(isSuccess.seller === "" || isSuccess.seller === "fail") &&
              seller?.payAmt! > 0 &&
              buyer?.payAmt! > 0 && <hr className="-mx-4 my-6" />}

            {buyer?.payAmt !== undefined && buyer?.payAmt > 0 && (
              <PayGroupItem label="차주" payAmt={buyer?.payAmt}>
                {!isDocumentUI &&
                  (isSuccess.buyer === "" ? (
                    // 25.05.19 지급요청 중 문구 임시 표시
                    <PayProceeding text="지급 요청 중" />
                  ) : isAllFail ? (
                    <div className="flex justify-between">
                      <PayFail errCd={buyer?.errCd ?? seller?.errCd} />
                      <Button.CtaButton
                        size={Size.Small}
                        state={"Default"}
                        disabled={isPast}
                        onClick={() => {
                          makeIsProgressing();
                          requestAllPayment();
                        }}
                      >
                        다시 요청하기
                      </Button.CtaButton>
                    </div>
                  ) : isSuccess.buyer === "success" ? (
                    <PaySuccess />
                  ) : (
                    <div className="flex justify-between">
                      <PayFail errCd={buyer?.errCd} />
                      <Button.CtaButton
                        size={Size.Small}
                        disabled={isPast}
                        state={"Default"}
                        onClick={() => {
                          makeIsProgressing();
                          requestBuyerPayment();
                        }}
                      >
                        다시 요청하기
                      </Button.CtaButton>
                    </div>
                  ))}
              </PayGroupItem>
            )}

            {/* 서류 요청 중 또는 서류 확인 중 */}
            {(adminReqStatCd === "00" || adminReqStatCd === "01") && (
              <PayProceeding text="서류 확인 중" />
            )}

            {/* 서류 반려 */}
            {adminReqStatCd === "02" && (
              <div className="flex justify-between">
                <PayFail text="서류반려" />
                <Button.CtaButton
                  size={Size.Small}
                  disabled={isPast}
                  state={"Default"}
                  onClick={() => router.push("/my-case/pay-request/loan-pay")}
                >
                  다시 요청하기
                </Button.CtaButton>
              </div>
            )}
          </div>
        </div>

        {!isDocumentUI && !isPast && (
          <footer>
            <Button.CtaButton
              size={Size.XLarge}
              state={"On"}
              disabled={!isAllPass}
              onClick={() =>
                router.push(`/my-case/cntr/${loanNo}?regType=${regType}`)
              }
            >
              확인
            </Button.CtaButton>
          </footer>
        )}
        <Alert
          isOpen={isOpen}
          title={"지급 실패건이 있습니다"}
          confirmText={"문의하기"}
          confirmCallBack={() => phoneInquiry()}
          cancelText={"닫기"}
          cancelCallBack={close}
          bodyText={failMsg}
        />

        {/* 대출금 요청 시 응답코드 999(응답 요청 지연)인 경우 */}
        <Alert
          isOpen={isOpen999Error}
          title={"요청 시간이 초과되었습니다."}
          bodyText={
            "은행 응답 지연으로 일시적인 오류가 발생할 수 있습니다. 다시 시도해 주시기 바랍니다."
          }
          confirmText={"확인"}
          confirmCallBack={close999Error}
        />
      </div>
    </>
  );
}
