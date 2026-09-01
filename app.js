/*
  MREO PROPERTY PROTOCOL
  GitHub Pages prototype functionality
*/

(() => {
  "use strict";

  /*
    OPTIONAL PROPERTY-DATA CONNECTION

    A static GitHub Pages site cannot directly read or scrape Zillow's
    property pages because Zillow does not make those pages available
    to arbitrary cross-origin browser JavaScript.

    The Seller Search below therefore works immediately for:
      - Zillow search
      - Google Maps search
      - address parsing
      - Seller-form address autofill

    It is also prepared for richer automatic property-data lookup.

    If MREO later connects a permitted property-data API through a
    serverless function, proxy, or other endpoint, define:

      window.MREO_PROPERTY_DATA_ENDPOINT =
        "https://your-endpoint.example.com/property";

    BEFORE app.js loads.

    MREO will call:

      GET <endpoint>?address=<encoded address>

    and automatically map common Zillow-style/property-data fields
    into the Seller form.
  */

  const PROPERTY_DATA_ENDPOINT =
    window.MREO_PROPERTY_DATA_ENDPOINT || "";

  const state = {
    activeModal: null,
    previouslyFocusedElement: null,
    mediaPreviewUrls: []
  };

  initialize();

  function initialize() {
    updateCopyrightYear();

    initializeSellerSearch();
    initializeSellerForm();

    initializeBuyerForm();
    initializeBuyerPropertySelection();

    initializeMediaPreview();

    initializeContracts();
    initializeModalControls();
  }

  /*
    ============================================
    GENERAL UTILITIES
    ============================================
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

  function setFieldValue(id, value, options = {}) {
    const field = document.getElementById(id);

    if (!field) {
      return false;
    }

    const {
      overwrite = true,
      markAutofilled = false
    } = options;

    if (
      !overwrite &&
      String(field.value || "").trim() !== ""
    ) {
      return false;
    }

    if (
      value === undefined ||
      value === null ||
      String(value).trim() === ""
    ) {
      return false;
    }

    field.value = String(value).trim();

    if (markAutofilled) {
      field.dataset.autofilled = "true";
    }

    field.dispatchEvent(
      new Event("input", {
        bubbles: true
      })
    );

    field.dispatchEvent(
      new Event("change", {
        bubbles: true
      })
    );

    return true;
  }

  function setText(
    id,
    value,
    fallback = "____________________"
  ) {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = value || fallback;
    }
  }

  function formatCurrency(value) {
    const number = Number(value);

    if (
      value === "" ||
      value === null ||
      value === undefined ||
      !Number.isFinite(number)
    ) {
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

  function showMessage(
    element,
    message,
    type = "success"
  ) {
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

  function cleanNumericValue(value) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return "";
    }

    if (typeof value === "number") {
      return Number.isFinite(value)
        ? value
        : "";
    }

    const cleaned = String(value)
      .replace(/[$,\s]/g, "")
      .replace(/[^\d.-]/g, "");

    const number = Number(cleaned);

    return Number.isFinite(number)
      ? number
      : "";
  }

  function firstDefined(...values) {
    for (const value of values) {
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        return value;
      }
    }

    return "";
  }

  /*
    ============================================
    ZILLOW AND GOOGLE MAPS URL BUILDERS
    ============================================
  */

  function buildZillowSearchUrl(address) {
    const encodedAddress = encodeURIComponent(address);

    return (
      `https://www.zillow.com/homes/${encodedAddress}_rb/`
    );
  }

  function buildGoogleMapsUrl(address) {
    const encodedAddress = encodeURIComponent(address);

    return (
      "https://www.google.com/maps/search/" +
      `?api=1&query=${encodedAddress}`
    );
  }

  /*
    ============================================
    SELLER PROPERTY SEARCH
    ============================================
  */

  function initializeSellerSearch() {
    const searchForm = document.getElementById(
      "seller-search-form"
    );

    if (!searchForm) {
      return;
    }

    searchForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        if (!searchForm.reportValidity()) {
          return;
        }

        const address = getFieldValue(
          "seller-property-search-address"
        );

        if (!address) {
          return;
        }

        const zillowUrl =
          buildZillowSearchUrl(address);

        const mapsUrl =
          buildGoogleMapsUrl(address);

        /*
          Open Zillow immediately.

          This happens before any asynchronous property-data request
          so browsers are less likely to block the new tab.
        */

        window.open(
          zillowUrl,
          "_blank",
          "noopener,noreferrer"
        );

        updateSellerSearchResults(
          address,
          zillowUrl,
          mapsUrl
        );

        /*
          First populate everything that can safely be determined
          from the address supplied by the Seller.
        */

        const parsedAddress =
          parseUnitedStatesAddress(address);

        const addressFieldCount =
          populateSellerAddressFields(parsedAddress);

        updateSellerContract();

        /*
          If no property-data endpoint has been connected yet,
          the static GitHub Pages version stops here.
        */

        if (!PROPERTY_DATA_ENDPOINT) {
          showSellerAutofillStatus(
            addressFieldCount > 0
              ? (
                  "The property address has been added to the " +
                  "Seller form below. Zillow has opened in a new " +
                  "tab. Review the available property information " +
                  "and complete or correct the remaining fields."
                )
              : (
                  "Zillow has opened in a new tab. The address could " +
                  "not be separated reliably into all of the Seller " +
                  "form fields, so please review and complete the " +
                  "property information below."
                )
          );

          scrollToSellerPropertyForm();

          return;
        }

        showSellerAutofillStatus(
          "The property address has been added. MREO is also " +
          "checking the connected property-data source for " +
          "additional information."
        );

        try {
          const propertyData =
            await fetchPropertyData(address);

          if (!propertyData) {
            showSellerAutofillStatus(
              "The address has been added, but no additional " +
              "property information was returned. Please review " +
              "Zillow and complete the remaining fields below."
            );

            scrollToSellerPropertyForm();

            return;
          }

          const populatedFields =
            populateSellerPropertyData(propertyData);

          updateSellerContract();

          if (populatedFields > 0) {
            showSellerAutofillStatus(
              `${populatedFields} additional property field` +
              `${populatedFields === 1 ? "" : "s"} ` +
              "were populated from the connected property-data " +
              "source. Please review the information before " +
              "submitting."
            );
          } else {
            showSellerAutofillStatus(
              "The property-data source responded, but no supported " +
              "additional fields were available. Please review " +
              "Zillow and complete the remaining information."
            );
          }

          scrollToSellerPropertyForm();
        } catch (error) {
          console.error(
            "MREO property-data lookup failed:",
            error
          );

          showSellerAutofillStatus(
            "The address has been added, but additional property " +
            "information could not be retrieved. Zillow is still " +
            "available in the new tab, and you can complete the " +
            "remaining fields manually."
          );

          scrollToSellerPropertyForm();
        }
      }
    );
  }

  function updateSellerSearchResults(
    address,
    zillowUrl,
    mapsUrl
  ) {
    const results = document.getElementById(
      "seller-search-result"
    );

    const addressLabel = document.getElementById(
      "seller-searched-property-address"
    );

    const zillowLink = document.getElementById(
      "seller-zillow-property-link"
    );

    const mapsLink = document.getElementById(
      "seller-google-maps-link"
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

  function showSellerAutofillStatus(message) {
    const status = document.getElementById(
      "seller-autofill-message"
    );

    if (!status) {
      return;
    }

    status.textContent = message;
  }

  function scrollToSellerPropertyForm() {
    const heading = document.getElementById(
      "property-information-heading"
    );

    if (!heading) {
      return;
    }

    heading.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  /*
    ============================================
    ADDRESS PARSING
    ============================================
  */

  function parseUnitedStatesAddress(address) {
    const cleanedAddress = String(address || "")
      .replace(/\s+/g, " ")
      .trim();

    const result = {
      street: "",
      city: "",
      state: "",
      zip: ""
    };

    if (!cleanedAddress) {
      return result;
    }

    /*
      Preferred format:

      123 Main Street, Dallas, TX 75201

      This also handles apartment/unit information containing
      an additional comma by treating the final two comma-separated
      sections as City and State/ZIP.
    */

    const pieces = cleanedAddress
      .split(",")
      .map((piece) => piece.trim())
      .filter(Boolean);

    if (pieces.length >= 3) {
      const stateZipPiece =
        pieces[pieces.length - 1];

      const cityPiece =
        pieces[pieces.length - 2];

      const streetPieces =
        pieces.slice(0, pieces.length - 2);

      const stateZipMatch =
        stateZipPiece.match(
          /^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/
        );

      const stateOnlyMatch =
        stateZipPiece.match(/^([A-Za-z]{2})$/);

      result.street = streetPieces.join(", ");
      result.city = cityPiece;

      if (stateZipMatch) {
        result.state =
          stateZipMatch[1].toUpperCase();

        result.zip =
          stateZipMatch[2];
      } else if (stateOnlyMatch) {
        result.state =
          stateOnlyMatch[1].toUpperCase();
      }

      return result;
    }

    /*
      Secondary pattern for a conventional complete address
      that happens to contain inconsistent comma spacing.
    */

    const completeAddressMatch =
      cleanedAddress.match(
        /^(.+?),\s*([^,]+?),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/
      );

    if (completeAddressMatch) {
      result.street =
        completeAddressMatch[1].trim();

      result.city =
        completeAddressMatch[2].trim();

      result.state =
        completeAddressMatch[3].toUpperCase();

      result.zip =
        completeAddressMatch[4];

      return result;
    }

    /*
      If MREO cannot confidently separate the full address,
      keep the entered value in the street-address field rather
      than inventing City/State/ZIP values.
    */

    result.street = cleanedAddress;

    return result;
  }

  function populateSellerAddressFields(addressData) {
    let count = 0;

    if (
      setFieldValue(
        "property-address",
        addressData.street,
        {
          markAutofilled: true
        }
      )
    ) {
      count += 1;
    }

    if (
      setFieldValue(
        "property-city",
        addressData.city,
        {
          markAutofilled: true
        }
      )
    ) {
      count += 1;
    }

    if (
      setFieldValue(
        "property-state",
        addressData.state,
        {
          markAutofilled: true
        }
      )
    ) {
      count += 1;
    }

    if (
      setFieldValue(
        "property-zip",
        addressData.zip,
        {
          markAutofilled: true
        }
      )
    ) {
      count += 1;
    }

    return count;
  }

  /*
    ============================================
    OPTIONAL PROPERTY-DATA LOOKUP
    ============================================

    This keeps credentials out of the GitHub Pages source.

    An API key should NOT be placed directly in this JavaScript file.
    A serverless/API endpoint can hold the credentials and return
    normalized property information to the browser.
  */

  async function fetchPropertyData(address) {
    const endpointUrl = new URL(
      PROPERTY_DATA_ENDPOINT,
      window.location.href
    );

    endpointUrl.searchParams.set(
      "address",
      address
    );

    const response = await fetch(
      endpointUrl.toString(),
      {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Property-data request failed with ${response.status}.`
      );
    }

    return response.json();
  }

  /*
    The mapper below accepts several common property-data response
    shapes. This means a future endpoint can return either a simple
    normalized object or a Zillow-style object without requiring the
    Seller form itself to be rewritten.
  */

  function normalizePropertyData(data) {
    if (!data || typeof data !== "object") {
      return {};
    }

    const property =
      data.property ||
      data.home ||
      data.result ||
      data.data ||
      data;

    const address =
      property.address &&
      typeof property.address === "object"
        ? property.address
        : {};

    return {
      street: firstDefined(
        address.streetAddress,
        address.street,
        property.streetAddress,
        property.street,
        property.addressLine1
      ),

      city: firstDefined(
        address.city,
        property.city
      ),

      state: firstDefined(
        address.state,
        property.state,
        property.stateCode
      ),

      zip: firstDefined(
        address.zipcode,
        address.zipCode,
        address.postalCode,
        property.zipcode,
        property.zipCode,
        property.postalCode
      ),

      propertyType: firstDefined(
        property.propertyType,
        property.homeType,
        property.type
      ),

      bedrooms: firstDefined(
        property.bedrooms,
        property.beds,
        property.bedroomCount
      ),

      bathrooms: firstDefined(
        property.bathrooms,
        property.baths,
        property.bathroomCount
      ),

      squareFeet: firstDefined(
        property.livingArea,
        property.livingAreaValue,
        property.squareFeet,
        property.sqft,
        property.floorSize
      ),

      lotSize: firstDefined(
        property.lotSize,
        property.lotAreaValue,
        property.lotArea,
        property.lotSizeText
      ),

      lotSizeUnit: firstDefined(
        property.lotAreaUnit,
        property.lotSizeUnit
      ),

      yearBuilt: firstDefined(
        property.yearBuilt,
        property.builtYear
      ),

      status: firstDefined(
        property.homeStatus,
        property.listingStatus,
        property.status
      ),

      price: firstDefined(
        property.price,
        property.listPrice,
        property.listingPrice
      ),

      estimatedValue: firstDefined(
        property.zestimate,
        property.estimatedValue,
        property.avm,
        property.valuation
      )
    };
  }

  function populateSellerPropertyData(rawData) {
    const data = normalizePropertyData(rawData);

    let count = 0;

    const addField = (
      id,
      value,
      options = {}
    ) => {
      if (
        setFieldValue(
          id,
          value,
          {
            overwrite:
              options.overwrite !== false,
            markAutofilled: true
          }
        )
      ) {
        count += 1;
      }
    };

    addField(
      "property-address",
      data.street
    );

    addField(
      "property-city",
      data.city
    );

    addField(
      "property-state",
      String(data.state || "").toUpperCase()
    );

    addField(
      "property-zip",
      data.zip
    );

    addField(
      "property-type",
      normalizePropertyType(
        data.propertyType
      )
    );

    addField(
      "property-bedrooms",
      cleanNumericValue(data.bedrooms)
    );

    addField(
      "property-bathrooms",
      cleanNumericValue(data.bathrooms)
    );

    addField(
      "property-size",
      cleanNumericValue(data.squareFeet)
    );

    addField(
      "property-lot-size",
      formatLotSize(
        data.lotSize,
        data.lotSizeUnit
      )
    );

    addField(
      "property-year-built",
      cleanNumericValue(data.yearBuilt)
    );

    addField(
      "property-public-status",
      formatPropertyStatus(data.status)
    );

    const publicPrice =
      cleanNumericValue(data.price);

    addField(
      "property-public-price",
      publicPrice
    );

    addField(
      "property-estimated-value",
      cleanNumericValue(
        data.estimatedValue
      )
    );

    /*
      If a current public listing price exists, use it as the
      initial Seller asking price only when the Seller has not
      already entered an asking price.

      The field remains editable.
    */

    if (
      setFieldValue(
        "asking-price",
        publicPrice,
        {
          overwrite: false,
          markAutofilled: true
        }
      )
    ) {
      count += 1;
    }

    return count;
  }

  function normalizePropertyType(value) {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ");

    if (!normalized) {
      return "";
    }

    if (
      normalized.includes("single") &&
      normalized.includes("family")
    ) {
      return "Single-family home";
    }

    if (
      normalized.includes("condo") ||
      normalized.includes("condominium")
    ) {
      return "Condominium";
    }

    if (
      normalized.includes("townhouse") ||
      normalized.includes("townhome")
    ) {
      return "Townhouse";
    }

    if (
      normalized.includes("multi") &&
      normalized.includes("family")
    ) {
      return "Multifamily";
    }

    if (
      normalized.includes("commercial")
    ) {
      return "Commercial";
    }

    if (
      normalized === "land" ||
      normalized.includes("vacant land") ||
      normalized.includes("lot")
    ) {
      return "Land";
    }

    return "Other";
  }

  function formatPropertyStatus(value) {
    const status = String(value || "")
      .trim()
      .replace(/[_-]+/g, " ")
      .toLowerCase();

    if (!status) {
      return "";
    }

    return status.replace(
      /\b\w/g,
      (letter) => letter.toUpperCase()
    );
  }

  function formatLotSize(value, unit) {
    if (
      value === undefined ||
      value === null ||
      String(value).trim() === ""
    ) {
      return "";
    }

    const rawValue =
      String(value).trim();

    const rawUnit =
      String(unit || "").trim();

    if (
      /acre|sq|feet|ft/i.test(rawValue)
    ) {
      return rawValue;
    }

    if (rawUnit) {
      return `${rawValue} ${rawUnit}`;
    }

    return rawValue;
  }

  /*
    ============================================
    SELLER PROPERTY FORM
    ============================================
  */

  function initializeSellerForm() {
    const sellerForm = document.getElementById(
      "seller-form"
    );

    if (!sellerForm) {
      return;
    }

    sellerForm.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        if (!sellerForm.reportValidity()) {
          return;
        }

        const sellerName =
          getFieldValue("seller-name");

        const propertyAddress =
          buildSellerPropertyAddress();

        updateSellerContract();

        const message =
          document.getElementById(
            "seller-message"
          );

        showMessage(
          message,
          `${sellerName}, your property information for ` +
            `${propertyAddress} has been prepared successfully. ` +
            "This demonstration does not transmit or permanently " +
            "store your information."
        );

        message.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      }
    );

    sellerForm.addEventListener(
      "input",
      updateSellerContract
    );

    sellerForm.addEventListener(
      "change",
      updateSellerContract
    );

    updateSellerContract();
  }

  function buildSellerPropertyAddress() {
    const street =
      getFieldValue("property-address");

    const city =
      getFieldValue("property-city");

    const stateCode =
      getFieldValue("property-state");

    const zipCode =
      getFieldValue("property-zip");

    const cityStateZip = [
      city,
      [stateCode, zipCode]
        .filter(Boolean)
        .join(" ")
    ]
      .filter(Boolean)
      .join(", ");

    return [
      street,
      cityStateZip
    ]
      .filter(Boolean)
      .join(", ");
  }

  function updateSellerContract() {
    setText(
      "contract-date",
      formatDate()
    );

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
      formatCurrency(
        getFieldValue("asking-price")
      )
    );
  }

  /*
    ============================================
    PROPERTY PHOTOGRAPH AND VIDEO PREVIEWS
    ============================================
  */

  function initializeMediaPreview() {
    const mediaInput =
      document.getElementById(
        "property-media"
      );

    const previewContainer =
      document.getElementById(
        "media-preview"
      );

    if (
      !mediaInput ||
      !previewContainer
    ) {
      return;
    }

    mediaInput.addEventListener(
      "change",
      () => {
        clearMediaPreviews(
          previewContainer
        );

        const files = Array.from(
          mediaInput.files || []
        );

        files.forEach((file) => {
          if (
            !isSupportedMediaFile(file)
          ) {
            return;
          }

          const previewUrl =
            URL.createObjectURL(file);

          state.mediaPreviewUrls.push(
            previewUrl
          );

          const figure =
            document.createElement(
              "figure"
            );

          figure.style.margin = "0";

          let preview;

          if (
            file.type.startsWith(
              "image/"
            )
          ) {
            preview =
              document.createElement(
                "img"
              );

            preview.src =
              previewUrl;

            preview.alt =
              file.name;

            preview.loading =
              "lazy";
          } else {
            preview =
              document.createElement(
                "video"
              );

            preview.src =
              previewUrl;

            preview.controls = true;
            preview.preload = "metadata";
            preview.muted = true;
          }

          const caption =
            document.createElement(
              "figcaption"
            );

          caption.textContent =
            shortenFilename(
              file.name
            );

          caption.style.marginTop =
            "6px";

          caption.style.fontSize =
            "11px";

          caption.style.color =
            "#66645d";

          caption.style.overflowWrap =
            "anywhere";

          figure.appendChild(
            preview
          );

          figure.appendChild(
            caption
          );

          previewContainer.appendChild(
            figure
          );
        });
      }
    );

    window.addEventListener(
      "pagehide",
      () => {
        clearMediaPreviews(
          previewContainer
        );
      }
    );
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

    return (
      `${filename.slice(0, 20)}…` +
      filename.slice(-6)
    );
  }

  function clearMediaPreviews(container) {
    state.mediaPreviewUrls.forEach(
      (url) => {
        URL.revokeObjectURL(url);
      }
    );

    state.mediaPreviewUrls = [];

    if (container) {
      container.replaceChildren();
    }
  }

  /*
    ============================================
    BUYER PROPERTY SELECTION
    ============================================

    properties.html will link to buyer.html using query parameters:

      buyer.html?address=...&price=...

    This allows the Buyer form to know which available property the
    user selected.
  */

  function initializeBuyerPropertySelection() {
    const addressField =
      document.getElementById(
        "buyer-offer-address"
      );

    if (!addressField) {
      return;
    }

    const parameters =
      new URLSearchParams(
        window.location.search
      );

    const propertyAddress =
      parameters.get("address");

    const propertyPrice =
      parameters.get("price");

    if (propertyAddress) {
      setFieldValue(
        "buyer-offer-address",
        propertyAddress,
        {
          markAutofilled: true
        }
      );
    }

    if (propertyPrice) {
      setFieldValue(
        "buyer-offer-amount",
        cleanNumericValue(
          propertyPrice
        ),
        {
          markAutofilled: true
        }
      );
    }

    if (
      propertyAddress ||
      propertyPrice
    ) {
      updateBuyerContract();
    }
  }

  /*
    ============================================
    BUYER INTEREST FORM
    ============================================
  */

  function initializeBuyerForm() {
    const buyerForm =
      document.getElementById(
        "buyer-form"
      );

    if (!buyerForm) {
      return;
    }

    buyerForm.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        if (!buyerForm.reportValidity()) {
          return;
        }

        const buyerName =
          getFieldValue("buyer-name");

        const address =
          getFieldValue(
            "buyer-offer-address"
          );

        updateBuyerContract();

        const message =
          document.getElementById(
            "buyer-message"
          );

        showMessage(
          message,
          `${buyerName}, your interest in ${address} has been ` +
            "prepared successfully. This demonstration does not " +
            "transmit your information or create a binding " +
            "purchase offer."
        );

        message.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      }
    );

    buyerForm.addEventListener(
      "input",
      updateBuyerContract
    );

    buyerForm.addEventListener(
      "change",
      updateBuyerContract
    );

    updateBuyerContract();
  }

  function updateBuyerContract() {
    const offerAddress =
      getFieldValue(
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
      offerAddress,
      "________________________________________________"
    );

    setText(
      "buyer-contract-price",
      formatCurrency(
        getFieldValue(
          "buyer-offer-amount"
        )
      )
    );
  }

  /*
    ============================================
    SELLER AND BUYER AGREEMENTS
    ============================================
  */

  function initializeContracts() {
    const printButtons =
      document.querySelectorAll(
        "[data-print-contract]"
      );

    printButtons.forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const contractId =
              button.dataset.printContract;

            printContract(
              contractId
            );
          }
        );
      }
    );
  }

  function printContract(contractId) {
    const contractBody =
      document.getElementById(
        contractId
      );

    if (!contractBody) {
      return;
    }

    const modal =
      contractBody.closest(
        ".contract-modal, .modal-overlay"
      );

    const titleElement = modal
      ? modal.querySelector(
          ".contract-header h2, .modal-header h2"
        )
      : null;

    const title = titleElement
      ? titleElement.textContent.trim()
      : "MREO As-Is Property Agreement";

    const printWindow =
      window.open(
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

    const safeTitle =
      escapeHtml(title);

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
    const temporaryElement =
      document.createElement("span");

    temporaryElement.textContent =
      value;

    return temporaryElement.innerHTML;
  }

  /*
    ============================================
    MODAL OPENING AND CLOSING
    ============================================
  */

  function initializeModalControls() {
    const openButtons =
      document.querySelectorAll(
        "[data-open-modal]"
      );

    const closeButtons =
      document.querySelectorAll(
        "[data-close-modal]"
      );

    openButtons.forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const modalId =
              button.dataset.openModal;

            if (
              modalId ===
              "seller-contract-modal"
            ) {
              updateSellerContract();
            }

            if (
              modalId ===
              "buyer-contract-modal"
            ) {
              updateBuyerContract();
            }

            openModal(modalId);
          }
        );
      }
    );

    closeButtons.forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const modal =
              button.closest(
                ".contract-modal, .modal-overlay"
              );

            closeModal(modal);
          }
        );
      }
    );

    document
      .querySelectorAll(
        ".contract-modal, .modal-overlay"
      )
      .forEach((modal) => {
        modal.addEventListener(
          "click",
          (event) => {
            if (
              event.target === modal
            ) {
              closeModal(modal);
            }
          }
        );
      });

    document.addEventListener(
      "keydown",
      (event) => {
        if (!state.activeModal) {
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();

          closeModal(
            state.activeModal
          );

          return;
        }

        if (event.key === "Tab") {
          keepFocusInsideModal(
            event
          );
        }
      }
    );
  }

  function openModal(modalId) {
    const modal =
      document.getElementById(
        modalId
      );

    if (!modal) {
      return;
    }

    state.previouslyFocusedElement =
      document.activeElement;

    state.activeModal = modal;

    modal.hidden = false;

    document.body.style.overflow =
      "hidden";

    const initialFocus =
      modal.querySelector(
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

    document.body.style.overflow =
      "";

    state.activeModal = null;

    if (
      state.previouslyFocusedElement &&
      typeof state
        .previouslyFocusedElement
        .focus === "function"
    ) {
      state.previouslyFocusedElement.focus();
    }

    state.previouslyFocusedElement =
      null;
  }

  function keepFocusInsideModal(event) {
    const focusableElements =
      Array.from(
        state.activeModal.querySelectorAll(
          'a[href], button:not([disabled]), ' +
            'input:not([disabled]), ' +
            'select:not([disabled]), ' +
            'textarea:not([disabled]), ' +
            '[tabindex]:not([tabindex="-1"])'
        )
      );

    if (
      focusableElements.length === 0
    ) {
      return;
    }

    const firstElement =
      focusableElements[0];

    const lastElement =
      focusableElements[
        focusableElements.length - 1
      ];

    if (
      event.shiftKey &&
      document.activeElement ===
        firstElement
    ) {
      event.preventDefault();

      lastElement.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement ===
        lastElement
    ) {
      event.preventDefault();

      firstElement.focus();
    }
  }
})();
