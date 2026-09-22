import {initCustomFunctions} from '../../app/data/variable'
import type {Metadata} from '../../app/data/load'
import {loadJSON} from 'arquero'
import {Formula} from '../../app/data/formula'
import {deflatorTable} from '../../app/utils'

initCustomFunctions()
const data = loadJSON('../../data.json.gz')
const deflator = deflatorTable()

describe('tests formula', () => {
  it('aligns with pre-calculated version', () => {
    cy.fixture('../../metadata.json', 'utf8').then(async content => {
      const meta = JSON.parse(content) as Metadata
      const formula = new Formula(meta.formula, {
        entity: 'general__district_code',
        time: 'general__fiscal_year',
      })
      const newData = formula.run(
        [],
        (await data).lookup(deflator, formula.refs.time).filter(`d.${formula.refs.time} > 2023`),
      )
      expect(
        newData
          .rollup({
            differ: 'sum(abs(d.ecs__entitlement - d.computed__entitlement) > 1e-7)',
          })
          .get('differ', 0),
      ).to.equal(55)
    })
  })
})
