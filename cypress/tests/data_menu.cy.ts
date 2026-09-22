function setSelect(labelId: string, option: string) {
  cy.get('#' + labelId)
    .parent()
    .click()
  cy.get('ul[aria-labelledby="' + labelId + '"]').within(() => {
    cy.get('li[data-value="' + option + '"]').click()
  })
}

describe('tests data menu', () => {
  it('can change time selection', () => {
    cy.visit('/', {timeout: 5000})
    setSelect('time_agg_select', 'specified')
  })
})
