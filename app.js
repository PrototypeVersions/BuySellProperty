/*
  MREO PROPERTY PROTOCOL
  GitHub Pages prototype functionality
*/

(() => {
  "use strict";

  const state = {
    activeModal: null,
    previouslyFocusedElement: null,
    mediaPreviewUrls: []
  };

  initialize();

  function initialize() {
    updateCopyrightYear();
    initializeSellerForm();
    initializeBuyerSearch();
    initializeBuyerForm();
    initializeMediaPreview();
    initializeContracts();
    initializeModalControls();
  }

  /*
    GENERAL UTILITIES
  */

  function updateCopyrightYear() {
    const yearElement = document.getElementById("current-year");

    if (yearElement) {
      yearElement.textContent = new Date().getFullYear();
    }
  }

  function getFieldValue(id) {
    const field = document.getElementById(id);

    return field ? field.value.trim() : "";
  }

  function formatCurrency(value) {
    const number = Number(value);

    if (!value || !Number.isFinite(number)) {
      return "____________________";
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(number);
  }

  function formatDate() {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    }).format(new Date());
  }

  function setText(id, value, fallback = "____________________") {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = value || fallback;
    }
  }

  function showMessage(element, message, type = "success") {
    if (!element) {
      return;
    }

    element.textContent = message;
    element.hidden = false;

    element.classList.remove(
      "success-message",
      "error-message",
      "status-success",
      "status-error"
    );

    if (type === "error") {
      element.classList.add("error-message");
    } else {
      element.classList.add("success-message");
    }
  }

  /*
    SELLER PROPERTY FORM
  */

  function initializeSellerForm() {
    const sellerForm = document.getElementById("seller-form");

    if (!sellerForm) {
      return;
    }

    sellerForm.addEventListener("submit", (event) => {
      event.preventDefault();

      if (!sellerForm.reportValidity()) {
        return;
      }

      const sellerName = getFieldValue("seller-name");
      const propertyAddress = buildSellerPropertyAddress();

      updateSellerContract();

      const message = document.getElementById("seller-message");

      showMessage(
        message,
        `${sellerName}, your property information for ${propertyAddress} ` +
          "has been prepared successfully. This demonstration does not " +
          "transmit or permanently store your information."
      );

      message.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    });

    sellerForm.addEventListener("input", updateSellerContract);
    sellerForm.addEventListener("change", updateSellerContract);

    updateSellerContract();
  }

  function buildSellerPropertyAddress() {
    const street = getFieldValue("property-address");
    const city = getFieldValue("property-city");
    const stateCode = getFieldValue("property-state");
    const zipCode = getFieldValue("property-zip");

    const cityStateZip = [
      city,
      [stateCode, zipCode].filter(Boolean).join(" ")
    ]
      .filter(Boolean)
      .join(", ");

    return [street, cityStateZip].filter(Boolean).join(", ");
  }

  function updateSellerContract() {
    setText("contract-date", formatDate());

    setText(
      "contract-seller-name",
      getFieldValue("seller-name")
    );

    setText(
      "contract-property-address",
      buildSellerPropertyAddress(),
      "________________________________________________"
    );

    setText(
      "contract-purchase-price",
      formatCurrency(getFieldValue("asking-price"))
    );
  }

  /*
    PROPERTY PHOTOGRAPH AND VIDEO PREVIEWS
  */

  function initializeMediaPreview() {
    const mediaInput = document.getElementById("property-media");
    const previewContainer = document.getElementById("media-preview");

    if (!mediaInput || !previewContainer) {
      return;
    }

    mediaInput.addEventListener("change", () => {
      clearMediaPreviews(previewContainer);

      const files = Array.from(mediaInput.files || []);

      files.forEach((file) => {
        if (!isSupportedMediaFile(file)) {
          return;
        }

        const previewUrl = URL.createObjectURL(file);

        state.mediaPreviewUrls.push(previewUrl);

        const figure = document.createElement("figure");

        figure.style.margin = "0";

        let preview;

        if (file.type.startsWith("image/")) {
          preview = document.createElement("img");

          preview.src = previewUrl;
          preview.alt = file.name;
          preview.loading = "lazy";
        } else {
          preview = document.createElement("video");

          preview.src = previewUrl;
          preview.controls = true;
          preview.preload = "metadata";
          preview.muted = true;
        }

        const caption = document.createElement("figcaption");

        caption.textContent = shortenFilename(file.name);

        caption.style.marginTop = "6px";
        caption.style.fontSize = "11px";
        caption.style.color = "#66645d";
        caption.style.overflowWrap = "anywhere";

        figure.appendChild(preview);
        figure.appendChild(caption);

        previewContainer.appendChild(figure);
      });
    });

    window.addEventListener("pagehide", () => {
      clearMediaPreviews(previewContainer);
    });
  }

  function isSupportedMediaFile(file) {
    return (
      file.type.startsWith("image/") ||
      file.type.startsWith("video/")
    );
  }

  function shortenFilename(filename) {
    if (filename.length <= 28) {
      return filename;
    }

    return `${filename.slice(0, 20)}…${filename.slice(-6)}`;
  }

  function clearMediaPreviews(container) {
    state.mediaPreviewUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });

    state.mediaPreviewUrls = [];

    if (container) {
      container.replaceChildren();
    }
  }

  /*
    BUYER PROPERTY SEARCH
  */

  function initializeBuyerSearch() {
    const searchForm = document.getElementById("buyer-search-form");

    if (!searchForm) {
      return;
    }

    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();

      if (!searchForm.reportValidity()) {
        return;
      }

      const address = getFieldValue("buyer-property-address");

      if (!address) {
        return;
      }

      const zillowUrl = buildZillowSearchUrl(address);
      const mapsUrl = buildGoogleMapsUrl(address);

      updateBuyerSearchResults(address, zillowUrl, mapsUrl);

      const offerAddress = document.getElementById(
        "buyer-offer-address"
      );

      if (offerAddress) {
        offerAddress.value = address;
      }

      updateBuyerContract();

      /*
        Open Zillow immediately after the button is clicked.

        If the browser blocks the new tab, the generated Zillow link
        remains available on the page.
      */

      window.open(
        zillowUrl,
        "_blank",
        "noopener,noreferrer"
      );
    });
  }

  function buildZillowSearchUrl(address) {
    const encodedAddress = encodeURIComponent(address);

    return `https://www.zillow.com/homes/${encodedAddress}_rb/`;
  }

  function buildGoogleMapsUrl(address) {
    const encodedAddress = encodeURIComponent(address);

    return (
      "https://www.google.com/maps/search/" +
      `?api=1&query=${encodedAddress}`
    );
  }

  function updateBuyerSearchResults(address, zillowUrl, mapsUrl) {
    const results = document.getElementById("buyer-search-result");

    const addressLabel = document.getElementById(
      "searched-property-address"
    );

    const zillowLink = document.getElementById(
      "zillow-property-link"
    );

    const mapsLink = document.getElementById(
      "google-maps-link"
    );

    if (addressLabel) {
      addressLabel.textContent = address;
    }

    if (zillowLink) {
      zillowLink.href = zillowUrl;
    }

    if (mapsLink) {
      mapsLink.href = mapsUrl;
    }

    if (results) {
      results.hidden = false;
    }
  }

  /*
    BUYER INTEREST FORM
  */

  function initializeBuyerForm() {
    const buyerForm = document.getElementById("buyer-form");

    if (!buyerForm) {
      return;
    }

    buyerForm.addEventListener("submit", (event) => {
      event.preventDefault();

      if (!buyerForm.reportValidity()) {
        return;
      }

      const buyerName = getFieldValue("buyer-name");

      const address = getFieldValue(
        "buyer-offer-address"
      );

      updateBuyerContract();

      const message = document.getElementById("buyer-message");

      showMessage(
        message,
        `${buyerName}, your interest in ${address} has been prepared ` +
          "successfully. This demonstration does not transmit your " +
          "information or create a binding purchase offer."
      );

      message.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    });

    buyerForm.addEventListener("input", updateBuyerContract);
    buyerForm.addEventListener("change", updateBuyerContract);

    updateBuyerContract();
  }

  function updateBuyerContract() {
    const searchedAddress = getFieldValue(
      "buyer-property-address"
    );

    const offerAddress = getFieldValue(
      "buyer-offer-address"
    );

    setText(
      "buyer-contract-date",
      formatDate()
    );

    setText(
      "buyer-contract-name",
      getFieldValue("buyer-name")
    );

    setText(
      "buyer-contract-address",
      offerAddress || searchedAddress,
      "________________________________________________"
    );

    setText(
      "buyer-contract-price",
      formatCurrency(
        getFieldValue("buyer-offer-amount")
      )
    );
  }

  /*
    SELLER AND BUYER AGREEMENTS
  */

  function initializeContracts() {
    const printButtons = document.querySelectorAll(
      "[data-print-contract]"
    );

    printButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const contractId = button.dataset.printContract;

        printContract(contractId);
      });
    });
  }

  function printContract(contractId) {
    const contractBody = document.getElementById(contractId);

    if (!contractBody) {
      return;
    }

    const modal = contractBody.closest(
      ".contract-modal, .modal-overlay"
    );

    const titleElement = modal
      ? modal.querySelector(".contract-header h2, .modal-header h2")
      : null;

    const title = titleElement
      ? titleElement.textContent.trim()
      : "MREO As-Is Property Agreement";

    const printWindow = window.open(
      "",
      "_blank",
      "width=850,height=1050"
    );

    if (!printWindow) {
      window.alert(
        "Please allow pop-ups to print the agreement."
      );

      return;
    }

    printWindow.opener = null;

    const safeTitle = escapeHtml(title);

    printWindow.document.write(`
      <!DOCTYPE html>

      <html lang="en">
        <head>
          <meta charset="UTF-8">

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          >

          <title>${safeTitle}</title>

          <style>
            @page {
              size: auto;
              margin: 0.55in;
            }

            * {
              box-sizing: border-box;
            }

            body {
              max-width: 760px;

              margin: 0 auto;

              color: #171717;

              font-family:
                "Helvetica Neue",
                Helvetica,
                Arial,
                sans-serif;

              font-size: 10.5pt;
              line-height: 1.45;
            }

            h1 {
              margin: 0 0 18px;
              padding-bottom: 12px;

              border-bottom: 2px solid #171717;

              font-size: 18pt;
              letter-spacing: -0.04em;
            }

            h3 {
              margin: 12px 0 4px;

              font-size: 10.5pt;
            }

            p {
              margin: 0 0 8px;
            }

            .signature-grid {
              margin-top: 34px;

              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
            }

            .signature-line {
              padding-top: 7px;

              border-top: 1px solid #171717;

              font-size: 9pt;
            }
          </style>
        </head>

        <body>
          <h1>${safeTitle}</h1>

          ${contractBody.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();

    printWindow.addEventListener(
      "load",
      () => {
        printWindow.focus();
        printWindow.print();
      },
      {
        once: true
      }
    );
  }

  function escapeHtml(value) {
    const temporaryElement = document.createElement("span");

    temporaryElement.textContent = value;

    return temporaryElement.innerHTML;
  }

  /*
    MODAL OPENING AND CLOSING
  */

  function initializeModalControls() {
    const openButtons = document.querySelectorAll(
      "[data-open-modal]"
    );

    const closeButtons = document.querySelectorAll(
      "[data-close-modal]"
    );

    openButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const modalId = button.dataset.openModal;

        if (modalId === "seller-contract-modal") {
          updateSellerContract();
        }

        if (modalId === "buyer-contract-modal") {
          updateBuyerContract();
        }

        openModal(modalId);
      });
    });

    closeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const modal = button.closest(
          ".contract-modal, .modal-overlay"
        );

        closeModal(modal);
      });
    });

    document.querySelectorAll(
      ".contract-modal, .modal-overlay"
    ).forEach((modal) => {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) {
          closeModal(modal);
        }
      });
    });

    document.addEventListener("keydown", (event) => {
      if (!state.activeModal) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();

        closeModal(state.activeModal);

        return;
      }

      if (event.key === "Tab") {
        keepFocusInsideModal(event);
      }
    });
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);

    if (!modal) {
      return;
    }

    state.previouslyFocusedElement = document.activeElement;
    state.activeModal = modal;

    modal.hidden = false;

    document.body.style.overflow = "hidden";

    const initialFocus = modal.querySelector(
      "[data-close-modal], button, a, input"
    );

    if (initialFocus) {
      initialFocus.focus();
    }
  }

  function closeModal(modal) {
    if (!modal) {
      return;
    }

    modal.hidden = true;

    document.body.style.overflow = "";

    state.activeModal = null;

    if (
      state.previouslyFocusedElement &&
      typeof state.previouslyFocusedElement.focus === "function"
    ) {
      state.previouslyFocusedElement.focus();
    }

    state.previouslyFocusedElement = null;
  }

  function keepFocusInsideModal(event) {
    const focusableElements = Array.from(
      state.activeModal.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), ' +
          'select:not([disabled]), textarea:not([disabled]), ' +
          '[tabindex]:not([tabindex="-1"])'
      )
    );

    if (focusableElements.length === 0) {
      return;
    }

    const firstElement = focusableElements[0];

    const lastElement =
      focusableElements[focusableElements.length - 1];

    if (
      event.shiftKey &&
      document.activeElement === firstElement
    ) {
      event.preventDefault();

      lastElement.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement === lastElement
    ) {
      event.preventDefault();

      firstElement.focus();
    }
  }
})();
