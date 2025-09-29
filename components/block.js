polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  assets: Ember.computed.alias('details.assets'),
  // Session Paging Variables
  pageSize: 5,
  init: function () {
    this.get('assets').forEach((asset, assetIndex) => {
      const installedSoftware = this.get(`assets.${assetIndex}.specific_data-data-installed_software`);
      if (Array.isArray(installedSoftware)) {
        this.set(
          `assets.${assetIndex}.__installedSoftwareFilteredPagingData`,
          this.get(`assets.${assetIndex}.specific_data-data-installed_software`)
        );
      } else {
        this.set(`assets.${assetIndex}.__installedSoftwareFilteredPagingData`, []);
      }

      this.setCurrentPage(assetIndex, 1);
    });
    this._super(...arguments);
  },
  actions: {
    // Start Paging Actions
    prevPage(assetIndex) {
      let currentPage = this.get(`assets.${assetIndex}.__currentPage`);

      if (currentPage > 1) {
        this.setCurrentPage(assetIndex, currentPage - 1);
      }
    },
    nextPage(assetIndex) {
      const totalResults = this.get(`assets.${assetIndex}.__installedSoftwareFilteredPagingData.length`);
      const totalPages = Math.ceil(totalResults / this.get('pageSize'));
      let currentPage = this.get(`assets.${assetIndex}.__currentPage`);
      if (currentPage < totalPages) {
        this.setCurrentPage(assetIndex, currentPage + 1);
      }
    },
    firstPage(assetIndex) {
      this.setCurrentPage(assetIndex, 1);
    },
    lastPage(assetIndex) {
      const totalResults = this.get(`assets.${assetIndex}.__installedSoftwareFilteredPagingData.length`);
      const totalPages = Math.ceil(totalResults / this.get('pageSize'));
      this.setCurrentPage(assetIndex, totalPages);
    },
    // End Paging Actions
    filterValueChanged(assetIndex, filterValue) {
      if (filterValue) {
        filterValue = filterValue.toLowerCase().trim();
        if (filterValue.length > 0) {
          this.set(
            `assets.${assetIndex}.__installedSoftwareFilteredPagingData`,
            this.get(`assets.${assetIndex}.specific_data-data-installed_software`).filter((software) => {
              if (!software.name_version && !software.vendor) {
                return true;
              }
              // Support filtering on vendor, name_version
              return (
                (software.vendor ? software.vendor.toLowerCase().includes(filterValue) : false) ||
                (software.name_version ? software.name_version.toLowerCase().includes(filterValue) : false)
              );
            })
          );
        }
      } else {
        this.set(
          `assets.${assetIndex}.__installedSoftwareFilteredPagingData`,
          this.get(`assets.${assetIndex}.specific_data-data-installed_software`)
        );
      }
      this.setCurrentPage(assetIndex, 1);
    }
  },
  /**
   * Needs to be updated anytime the currentPage changes
   * @param assetIndex
   */
  setPagingStartItem(assetIndex) {
    let currentPage = this.get(`assets.${assetIndex}.__currentPage`);
    const pagingStartItem = (currentPage - 1) * this.get('pageSize') + 1;
    this.set(`assets.${assetIndex}.__pagingStartItem`, pagingStartItem);
    this.setPagingEndItem(assetIndex);
  },
  /**
   * Should update after pagingStartItem changes
   * @param assetIndex
   */
  setPagingEndItem(assetIndex) {
    const pagingEndItem = this.get(`assets.${assetIndex}.__pagingStartItem`) - 1 + this.get('pageSize');
    this.set(`assets.${assetIndex}.__pagingEndItem`, pagingEndItem);
  },
  /**
   * Should update after currentPage changes
   * @param assetIndex
   */
  setIsPrevButtonsDisabled(assetIndex) {
    let currentPage = this.get(`assets.${assetIndex}.__currentPage`);
    this.set(`assets.${assetIndex}.__isPrevButtonsDisabled`, currentPage === 1);
  },
  /**
   * Should update after currentPage changes or __installedSoftwareFilteredPagingData.length changes
   * @param assetIndex
   */
  setIsNextButtonDisabled(assetIndex) {
    const currentPage = this.get(`assets.${assetIndex}.__currentPage`);
    const totalResults = this.get(`assets.${assetIndex}.__installedSoftwareFilteredPagingData.length`);
    const totalPages = Math.ceil(totalResults / this.get('pageSize'));
    this.set(`assets.${assetIndex}.__isNextButtonsDisabled`, currentPage === totalPages);
  },
  setPagingData(assetIndex) {
    if (!this.get(`assets.${assetIndex}.__installedSoftwareFilteredPagingData`)) {
      this.set(`assets.${assetIndex}.__installedSoftwarePagingData`, []);
    }

    const currentPage = this.get(`assets.${assetIndex}.__currentPage`);
    const startIndex = (currentPage - 1) * this.get('pageSize');
    const endIndex = startIndex + this.get('pageSize');

    this.set(
      `assets.${assetIndex}.__installedSoftwarePagingData`,
      this.get(`assets.${assetIndex}.__installedSoftwareFilteredPagingData`).slice(startIndex, endIndex)
    );
  },
  setCurrentPage(assetIndex, currentPageValue) {
    this.set(`assets.${assetIndex}.__currentPage`, currentPageValue);

    // The following values must update if currentPage updates
    this.setPagingStartItem(assetIndex);
    this.setIsPrevButtonsDisabled(assetIndex);
    this.setIsNextButtonDisabled(assetIndex);
    this.setPagingData(assetIndex);
  }
});
